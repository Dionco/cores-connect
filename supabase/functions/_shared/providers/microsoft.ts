import type { EmployeeRow, ProvisioningProvider } from '../automation/types.ts';

declare const Deno: {
  env: {
    get: (name: string) => string | undefined;
  };
};

interface MicrosoftGraphConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  domain: string;
  usageLocation: string;
  businessPremiumSkuId: string | null;
  defaultGroupId: string | null;
  sharedMailboxes: {
    trading: string;
    byDepartment: Record<EmployeeRow['department'], string>;
  };
}

interface GraphUser {
  id: string;
  userPrincipalName: string;
}

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const EXO_BASE_URL = 'https://outlook.office365.com/adminapi/beta';
const EXO_TIMEOUT_MS = Number(Deno.env.get('MS_EXO_REQUEST_TIMEOUT_MS') || 20_000);
const EXO_MAX_ATTEMPTS = Number(Deno.env.get('MS_EXO_MAX_ATTEMPTS') || 3);
const EXO_BASE_RETRY_DELAY_MS = Number(Deno.env.get('MS_EXO_BASE_RETRY_DELAY_MS') || 1_000);

const slugifyName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const deriveDefaultUpn = (employee: EmployeeRow, domain: string): string => {
  const first = slugifyName(employee.first_name);
  const last = slugifyName(employee.last_name);
  return `${first}.${last}@${domain}`;
};

const deriveMailNickname = (employee: EmployeeRow): string => {
  const first = slugifyName(employee.first_name);
  const last = slugifyName(employee.last_name);
  return `${first}${last}`.slice(0, 64) || `user${Date.now()}`;
};

const generateInitialPassword = (): string => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  let password = '';
  for (let i = 0; i < 20; i += 1) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  return password;
};

const getRequiredEnv = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const getConfig = (): MicrosoftGraphConfig => {
  const domain = getRequiredEnv('MS_GRAPH_DOMAIN');
  return {
    tenantId: getRequiredEnv('MS_GRAPH_TENANT_ID'),
    clientId: getRequiredEnv('MS_GRAPH_CLIENT_ID'),
    clientSecret: getRequiredEnv('MS_GRAPH_CLIENT_SECRET'),
    domain,
    usageLocation: Deno.env.get('MS_GRAPH_USAGE_LOCATION') || 'NL',
    businessPremiumSkuId: Deno.env.get('MS_GRAPH_BUSINESS_PREMIUM_SKU_ID') || null,
    defaultGroupId: Deno.env.get('MS_GRAPH_DEFAULT_GROUP_ID') || null,
    sharedMailboxes: {
      trading: Deno.env.get('MS_EXO_SHARED_MAILBOX_TRADING') || `trading@${domain}`,
      byDepartment: {
        Sales: Deno.env.get('MS_EXO_SHARED_MAILBOX_SALES') || `sales@${domain}`,
        'Customs & Compliance': Deno.env.get('MS_EXO_SHARED_MAILBOX_CUSTOMS') || `customs@${domain}`,
        Transport: Deno.env.get('MS_EXO_SHARED_MAILBOX_TRANSPORT') || `transport@${domain}`,
      },
    },
  };
};

const readGraphError = async (response: Response): Promise<string> => {
  const fallback = `${response.status} ${response.statusText}`;

  try {
    const raw = await response.text();
    if (!raw) {
      return fallback;
    }

    const payload = JSON.parse(raw) as { error?: { message?: string }; message?: string };
    const message = payload?.error?.message || payload?.message;
    if (message) {
      return message;
    }

    return raw;
  } catch {
    // Ignore malformed payloads and fall back to status text.
  }

  return fallback;
};

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isTransientExoStatus = (status: number): boolean =>
  [408, 425, 429, 500, 502, 503, 504].includes(status);

const computeRetryDelayMs = (attempt: number): number => {
  const exponential = EXO_BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 250);
  return exponential + jitter;
};

const isTransientNetworkError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return (
    message.includes('timed out')
    || message.includes('fetch failed')
    || message.includes('connection')
    || message.includes('network')
    || message.includes('tempor')
  );
};

const fetchWithTimeout = async (url: string, init: RequestInit, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

const getAccessToken = async (config: MicrosoftGraphConfig, scope: string): Promise<string> => {
  const tokenEndpoint = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'client_credentials',
    scope,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Failed to acquire token (scope: ${scope}): ${await readGraphError(response)}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('Token response did not include an access token');
  }
  return payload.access_token;
};

const createGraphHeaders = (accessToken: string): HeadersInit => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
});

const getExistingUserByUpn = async (accessToken: string, upn: string): Promise<GraphUser | null> => {
  const response = await fetch(
    `${GRAPH_BASE_URL}/users/${encodeURIComponent(upn)}?$select=id,userPrincipalName`,
    {
      method: 'GET',
      headers: createGraphHeaders(accessToken),
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to check existing user: ${await readGraphError(response)}`);
  }

  const user = (await response.json()) as GraphUser;
  return user;
};

const createOrReuseUser = async (
  accessToken: string,
  config: MicrosoftGraphConfig,
  employee: EmployeeRow,
): Promise<{ user: GraphUser; reused: boolean }> => {
  const upn = employee.email || deriveDefaultUpn(employee, config.domain);
  const mailNickname = deriveMailNickname(employee);
  const initialPassword = Deno.env.get('MS_GRAPH_INITIAL_PASSWORD') || generateInitialPassword();

  const response = await fetch(`${GRAPH_BASE_URL}/users`, {
    method: 'POST',
    headers: createGraphHeaders(accessToken),
    body: JSON.stringify({
      accountEnabled: true,
      displayName: `${employee.first_name} ${employee.last_name}`,
      mailNickname,
      userPrincipalName: upn,
      givenName: employee.first_name,
      surname: employee.last_name,
      usageLocation: config.usageLocation,
      passwordProfile: {
        forceChangePasswordNextSignIn: true,
        password: initialPassword,
      },
    }),
  });

  if (response.ok) {
    const user = (await response.json()) as GraphUser;
    return { user, reused: false };
  }

  const errorMessage = await readGraphError(response);
  const alreadyExists = response.status === 400 && /already exists|conflict/i.test(errorMessage);

  if (!alreadyExists) {
    throw new Error(`Failed to create M365 user: ${errorMessage}`);
  }

  const existingUser = await getExistingUserByUpn(accessToken, upn);
  if (!existingUser) {
    throw new Error(`User appears to exist but could not be retrieved: ${upn}`);
  }

  return { user: existingUser, reused: true };
};

const ensureUsageLocation = async (
  accessToken: string,
  userId: string,
  usageLocation: string,
): Promise<void> => {
  const response = await fetch(`${GRAPH_BASE_URL}/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: createGraphHeaders(accessToken),
    body: JSON.stringify({ usageLocation }),
  });

  if (!response.ok) {
    throw new Error(`Failed to set usage location: ${await readGraphError(response)}`);
  }
};

const assignBusinessPremiumLicense = async (
  accessToken: string,
  userId: string,
  skuId: string,
): Promise<void> => {
  const response = await fetch(`${GRAPH_BASE_URL}/users/${encodeURIComponent(userId)}/assignLicense`, {
    method: 'POST',
    headers: createGraphHeaders(accessToken),
    body: JSON.stringify({
      addLicenses: [{ skuId }],
      removeLicenses: [],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to assign Business Premium license: ${await readGraphError(response)}`);
  }
};

const addUserToGroup = async (
  accessToken: string,
  userId: string,
  groupId: string,
): Promise<'added' | 'already-member'> => {
  const response = await fetch(`${GRAPH_BASE_URL}/groups/${encodeURIComponent(groupId)}/members/$ref`, {
    method: 'POST',
    headers: createGraphHeaders(accessToken),
    body: JSON.stringify({
      '@odata.id': `${GRAPH_BASE_URL}/directoryObjects/${encodeURIComponent(userId)}`,
    }),
  });

  if (response.status === 204) {
    return 'added';
  }

  const errorMessage = await readGraphError(response);
  if (response.status === 400 && /already exist|added object references already exist/i.test(errorMessage)) {
    return 'already-member';
  }

  throw new Error(`Failed to add user to group ${groupId}: ${errorMessage}`);
};

// Grant a user FullAccess to an Exchange shared mailbox via the Exchange Online
// cmdlet invocation API. This mirrors exactly what the EXO V3 PowerShell module
// does — it POSTs to /InvokeCommand with a CmdletInput body rather than using
// OData entity operations (which don't support creating new permissions).
//
// Required app permission: Exchange.ManageAsApp (Exchange Online)
// Exchange RBAC role: Mail Recipients (assigned via New-ManagementRoleAssignment)
// Token scope: https://outlook.office365.com/.default
const addUserToSharedMailbox = async (
  exoToken: string,
  tenantId: string,
  mailboxEmail: string,
  userUpn: string,
): Promise<{ status: 'added' | 'already-member'; attempts: number; latencyMs: number }> => {
  const url = `${EXO_BASE_URL}/${encodeURIComponent(tenantId)}/InvokeCommand`;

  const body = JSON.stringify({
    CmdletInput: {
      CmdletName: 'Add-MailboxPermission',
      Parameters: {
        Identity: mailboxEmail,
        User: userUpn,
        AccessRights: ['FullAccess'],
        AutoMapping: true,
        Confirm: false,
      },
    },
  });

  for (let attempt = 1; attempt <= EXO_MAX_ATTEMPTS; attempt += 1) {
    const startedAt = Date.now();
    let response: Response;

    try {
      response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${exoToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-CmdletName': 'Add-MailboxPermission',
            'X-ResponseFormat': 'clixml',
            'X-SerializationLevel': 'Partial',
            'X-AnchorMailbox': `SMTP:${mailboxEmail}`,
            'Accept-Language': 'en-US',
          },
          body,
        },
        EXO_TIMEOUT_MS,
      );
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const transient = isTransientNetworkError(error);

      if (transient && attempt < EXO_MAX_ATTEMPTS) {
        await sleep(computeRetryDelayMs(attempt));
        continue;
      }

      const message = error instanceof Error ? error.message : 'Unknown network error';
      throw new Error(
        `Failed to grant FullAccess on ${mailboxEmail} to ${userUpn} (category: ${transient ? 'transient' : 'permanent'}; attempt: ${attempt}/${EXO_MAX_ATTEMPTS}; latencyMs: ${elapsedMs}): ${message}`,
      );
    }

    const elapsedMs = Date.now() - startedAt;

    if (response.ok) {
      return { status: 'added', attempts: attempt, latencyMs: elapsedMs };
    }

    const errorMessage = await readGraphError(response);
    // Add-MailboxPermission is generally idempotent but may surface this error
    // if the ACE already exists in some configurations.
    if (/already exists|already has|duplicate|ACE already/i.test(errorMessage)) {
      return { status: 'already-member', attempts: attempt, latencyMs: elapsedMs };
    }

    const transient = isTransientExoStatus(response.status);
    if (transient && attempt < EXO_MAX_ATTEMPTS) {
      await sleep(computeRetryDelayMs(attempt));
      continue;
    }

    throw new Error(
      `Failed to grant FullAccess on ${mailboxEmail} to ${userUpn} (category: ${transient ? 'transient' : 'permanent'}; attempt: ${attempt}/${EXO_MAX_ATTEMPTS}; latencyMs: ${elapsedMs}; status: ${response.status}): ${errorMessage}`,
    );
  }

  throw new Error(`Failed to grant FullAccess on ${mailboxEmail} to ${userUpn}: exhausted retry attempts`);
};

export const microsoftProvider: ProvisioningProvider = {
  service: 'M365',
  workflowName: 'm365-onboarding-v1',
  run: async (employee: EmployeeRow) => {
    const config = getConfig();

    // Graph token — used for user creation, licence assignment, and M365 Group membership.
    const graphToken = await getAccessToken(config, 'https://graph.microsoft.com/.default');

    // EXO token — used for Exchange shared mailbox permission grants.
    // Requires Exchange.ManageAsApp app permission on the Entra app registration.
    const exoToken = await getAccessToken(config, 'https://outlook.office365.com/.default');

    const logs: Array<{ step: string; status: 'done' | 'pending' | 'error'; timestamp: string }> = [];

    const { user, reused } = await createOrReuseUser(graphToken, config, employee);
    logs.push({
      step: reused
        ? `Reused existing M365 user ${user.userPrincipalName}`
        : `Created M365 account ${user.userPrincipalName}`,
      status: 'done',
      timestamp: new Date().toISOString(),
    });

    if (!reused) {
      // Entra directory changes are eventually consistent. Wait for the new
      // user to propagate before setting usage location and assigning a licence,
      // otherwise both calls race against the write and fail intermittently.
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }

    if (config.businessPremiumSkuId) {
      if (reused) {
        // Reused users may pre-date the usageLocation field being set at creation time.
        await ensureUsageLocation(graphToken, user.id, config.usageLocation);
      }
      await assignBusinessPremiumLicense(graphToken, user.id, config.businessPremiumSkuId);
      logs.push({
        step: 'Assigned Business Premium licence',
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    } else {
      logs.push({
        step: 'Skipped license assignment (MS_GRAPH_BUSINESS_PREMIUM_SKU_ID not configured)',
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    }

    // Grant FullAccess on trading@cores.nl to all employees.
    const tradingMailbox = config.sharedMailboxes.trading;
    const tradingResult = await addUserToSharedMailbox(
      exoToken,
      config.tenantId,
      tradingMailbox,
      user.userPrincipalName,
    );
    logs.push({
      step:
        tradingResult.status === 'added'
          ? `Granted FullAccess on shared mailbox ${tradingMailbox} (attempts: ${tradingResult.attempts}; latencyMs: ${tradingResult.latencyMs})`
          : `User already has FullAccess on shared mailbox ${tradingMailbox} (attempts: ${tradingResult.attempts}; latencyMs: ${tradingResult.latencyMs})`,
      status: 'done',
      timestamp: new Date().toISOString(),
    });

    // Grant FullAccess on the department-specific shared mailbox.
    const deptMailbox = config.sharedMailboxes.byDepartment[employee.department];
    if (deptMailbox) {
      const deptResult = await addUserToSharedMailbox(
        exoToken,
        config.tenantId,
        deptMailbox,
        user.userPrincipalName,
      );
      logs.push({
        step:
          deptResult.status === 'added'
            ? `Granted FullAccess on department mailbox ${deptMailbox} (attempts: ${deptResult.attempts}; latencyMs: ${deptResult.latencyMs})`
            : `User already has FullAccess on department mailbox ${deptMailbox} (attempts: ${deptResult.attempts}; latencyMs: ${deptResult.latencyMs})`,
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    }

    if (config.defaultGroupId) {
      const membership = await addUserToGroup(graphToken, user.id, config.defaultGroupId);
      logs.push({
        step:
          membership === 'added'
            ? 'Added user to Cores SharePoint site (cores_algemeen)'
            : 'User already in Cores SharePoint site (cores_algemeen)',
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    } else {
      logs.push({
        step: 'Skipped default SharePoint group assignment (MS_GRAPH_DEFAULT_GROUP_ID not configured)',
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    }

    return logs;
  },
};
