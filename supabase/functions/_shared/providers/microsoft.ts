import type { EmployeeRow, ProvisioningOptions, ProvisioningProvider } from '../automation/types.ts';

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
  defaultSiteId: string | null;
  securityGroupIds: string[];
  sharedMailboxes: {
    trading: string;
    byDepartment: Record<EmployeeRow['department'], string>;
  };
}

interface SecurityGroup {
  id: string;
  displayName: string;
}

interface SharedMailbox {
  email: string;
  displayName: string;
}

interface GraphUser {
  id: string;
  userPrincipalName: string;
}

interface ExoSharedMailboxRecord {
  DisplayName?: string;
  displayName?: string;
  Name?: string;
  PrimarySmtpAddress?: string | { Address?: string };
  primarySmtpAddress?: string | { Address?: string };
  WindowsEmailAddress?: string;
  windowsEmailAddress?: string;
  ExternalDirectoryObjectId?: string;
}

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';
const GRAPH_BETA_BASE_URL = 'https://graph.microsoft.com/beta';
const EXO_BASE_URL = 'https://outlook.office365.com/adminapi/beta';
const EXO_TIMEOUT_MS = Number(Deno.env.get('MS_EXO_REQUEST_TIMEOUT_MS') || 20_000);
const EXO_MAX_ATTEMPTS = Number(Deno.env.get('MS_EXO_MAX_ATTEMPTS') || 6);
const EXO_BASE_RETRY_DELAY_MS = Number(Deno.env.get('MS_EXO_BASE_RETRY_DELAY_MS') || 2_000);

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

export const getConfig = (): MicrosoftGraphConfig => {
  const domain = getRequiredEnv('MS_GRAPH_DOMAIN');
  return {
    tenantId: getRequiredEnv('MS_GRAPH_TENANT_ID'),
    clientId: getRequiredEnv('MS_GRAPH_CLIENT_ID'),
    clientSecret: getRequiredEnv('MS_GRAPH_CLIENT_SECRET'),
    domain,
    usageLocation: Deno.env.get('MS_GRAPH_USAGE_LOCATION') || 'NL',
    businessPremiumSkuId: Deno.env.get('MS_GRAPH_BUSINESS_PREMIUM_SKU_ID') || null,
    defaultGroupId: Deno.env.get('MS_GRAPH_DEFAULT_GROUP_ID') || null,
    defaultSiteId: Deno.env.get('MS_GRAPH_DEFAULT_SITE_ID') || null,
    securityGroupIds: (Deno.env.get('MS_GRAPH_SECURITY_GROUP_IDS') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
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

    const payload = JSON.parse(raw) as {
      error?: { message?: string; details?: unknown; innererror?: unknown };
      message?: string;
      details?: unknown;
    };
    const message = payload?.error?.message || payload?.message;
    if (message) {
      // EXO cmdlet APIs often return generic messages with useful diagnostics in nested details.
      const details = payload?.error?.details ?? payload?.details ?? payload?.error?.innererror;
      if (details) {
        return `${message} | details: ${JSON.stringify(details)}`;
      }
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

const isTransientExoCmdletNotReadyError = (status: number, message: string): boolean => {
  if (status !== 404) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes('error executing cmdlet')
    || normalized.includes('couldn\'t be found')
    || normalized.includes('cannot find')
    || normalized.includes('was not found')
    || normalized.includes('object not found')
  );
};

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

export const getAccessToken = async (config: MicrosoftGraphConfig, scope: string): Promise<string> => {
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

const favoriteSharePointSite = async (
  accessToken: string,
  userId: string,
  siteId: string,
): Promise<'added' | 'already-member'> => {
  const response = await fetch(
    `${GRAPH_BASE_URL}/users/${encodeURIComponent(userId)}/sites/${encodeURIComponent(siteId)}/microsoft.graph.add`,
    {
      method: 'POST',
      headers: createGraphHeaders(accessToken),
    },
  );

  if (response.status === 204) {
    return 'added';
  }

  const errorMessage = await readGraphError(response);
  // The endpoint may return 400 if site is already favorited
  if (response.status === 400 && /already|favorite/i.test(errorMessage)) {
    return 'already-member';
  }

  if (!response.ok) {
    throw new Error(`Failed to favorite SharePoint site ${siteId}: ${errorMessage}`);
  }

  return 'added';
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

    const transient = isTransientExoStatus(response.status) || isTransientExoCmdletNotReadyError(response.status, errorMessage);
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

export const listSecurityGroups = async (accessToken: string): Promise<SecurityGroup[]> => {
  const groups: SecurityGroup[] = [];
  let url: string | null =
    `${GRAPH_BASE_URL}/groups?$filter=securityEnabled eq true&$select=id,displayName&$top=999&$count=true`;

  while (url) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...createGraphHeaders(accessToken),
        ConsistencyLevel: 'eventual',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list security groups: ${await readGraphError(response)}`);
    }

    const payload = (await response.json()) as {
      value: SecurityGroup[];
      '@odata.nextLink'?: string;
    };

    groups.push(...payload.value);
    url = payload['@odata.nextLink'] ?? null;
  }

  return groups;
};

export const listSharedMailboxes = async (accessToken: string): Promise<SharedMailbox[]> => {
  const mailboxes: SharedMailbox[] = [];
  let url: string | null =
    `${GRAPH_BETA_BASE_URL}/users?$select=displayName,mail,mailboxSettings,assignedLicenses&$top=999`;

  while (url) {
    const response = await fetch(url, {
      method: 'GET',
      headers: createGraphHeaders(accessToken),
    });

    if (!response.ok) {
      throw new Error(`Failed to list shared mailboxes: ${await readGraphError(response)}`);
    }

    const payload = (await response.json()) as {
      value: Array<{
        displayName?: string;
        mail?: string | null;
        mailboxSettings?: { userPurpose?: string };
        assignedLicenses?: Array<{ skuId?: string }>;
      }>;
      '@odata.nextLink'?: string;
    };

    for (const item of payload.value) {
      if (!item.mail) {
        continue;
      }

      const userPurpose = item.mailboxSettings?.userPurpose?.toLowerCase();
      const isSharedByPurpose = userPurpose === 'shared';
      const hasNoLicenses = (item.assignedLicenses?.length || 0) === 0;

      // Prefer explicit mailbox purpose and fall back to unlicensed mailboxes.
      if (!isSharedByPurpose && !hasNoLicenses) {
        continue;
      }

      mailboxes.push({
        email: item.mail,
        displayName: item.displayName || item.mail,
      });
    }

    url = payload['@odata.nextLink'] ?? null;
  }

  return mailboxes;
};

const getConfiguredSharedMailboxes = (config: MicrosoftGraphConfig): SharedMailbox[] => {
  const configured = [config.sharedMailboxes.trading, ...Object.values(config.sharedMailboxes.byDepartment)];
  const unique = [...new Set(configured.map((mailbox) => mailbox.trim()).filter(Boolean))];

  return unique.map((email) => ({
    email,
    displayName: email.split('@')[0],
  }));
};

const normalizeSharedMailboxFromExo = (row: ExoSharedMailboxRecord): SharedMailbox | null => {
  const smtpAddress = row.PrimarySmtpAddress || row.primarySmtpAddress;
  const email =
    typeof smtpAddress === 'string'
      ? smtpAddress
      : smtpAddress?.Address || row.WindowsEmailAddress || row.windowsEmailAddress || null;

  if (!email) {
    return null;
  }

  const displayName = row.DisplayName || row.displayName || row.Name || email;

  return { email, displayName };
};

const listSharedMailboxesViaExo = async (
  exoToken: string,
  tenantId: string,
): Promise<SharedMailbox[]> => {
  const url = `${EXO_BASE_URL}/${encodeURIComponent(tenantId)}/InvokeCommand`;
  const response = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${exoToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-CmdletName': 'Get-EXOMailbox',
        'X-ResponseFormat': 'json',
        'X-SerializationLevel': 'Full',
      },
      body: JSON.stringify({
        CmdletInput: {
          CmdletName: 'Get-EXOMailbox',
          Parameters: {
            RecipientTypeDetails: ['SharedMailbox'],
            ResultSize: 'Unlimited',
          },
        },
      }),
    },
    EXO_TIMEOUT_MS,
  );

  if (!response.ok) {
    throw new Error(`Failed to list shared mailboxes via EXO: ${await readGraphError(response)}`);
  }

  const payload = (await response.json()) as {
    value?: ExoSharedMailboxRecord[];
    results?: ExoSharedMailboxRecord[];
    output?: ExoSharedMailboxRecord[];
    Output?: ExoSharedMailboxRecord[];
    Data?: ExoSharedMailboxRecord[];
  } | ExoSharedMailboxRecord[];

  const rows = Array.isArray(payload)
    ? payload
    : payload.value || payload.results || payload.output || payload.Output || payload.Data || [];

  const mapped = rows
    .map(normalizeSharedMailboxFromExo)
    .filter((row): row is SharedMailbox => Boolean(row));

  const unique = [...new Map(mapped.map((row) => [row.email.toLowerCase(), row])).values()];

  return unique;
};

export const listSharedMailboxesWithFallback = async (
  config: MicrosoftGraphConfig,
  graphToken: string,
  exoToken?: string,
): Promise<SharedMailbox[]> => {
  if (exoToken) {
    try {
      const fromExo = await listSharedMailboxesViaExo(exoToken, config.tenantId);
      if (fromExo.length > 0) {
        return fromExo;
      }
    } catch (error) {
      console.error('EXO shared mailbox lookup failed', error);
    }
  }

  try {
    const fromGraph = await listSharedMailboxes(graphToken);
    if (fromGraph.length > 0) {
      return fromGraph;
    }
  } catch (error) {
    console.error('Graph shared mailbox lookup failed', error);
  }

  return getConfiguredSharedMailboxes(config);
};

const addUserToSecurityGroups = async (
  accessToken: string,
  userId: string,
  groupIds: string[],
): Promise<{
  logs: Array<{ step: string; status: 'done' | 'pending' | 'error'; timestamp: string }>;
  errors: string[];
}> => {
  const logs: Array<{ step: string; status: 'done' | 'pending' | 'error'; timestamp: string }> = [];
  const errors: string[] = [];

  for (const groupId of groupIds) {
    try {
      const membership = await addUserToGroup(accessToken, userId, groupId);
      logs.push({
        step:
          membership === 'added'
            ? `Added user to security group ${groupId}`
            : `User already in security group ${groupId}`,
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to add user to security group ${groupId}`;
      errors.push(message);
      logs.push({
        step: message,
        status: 'error',
        timestamp: new Date().toISOString(),
      });
    }
  }

  return { logs, errors };
};

export const microsoftProvider: ProvisioningProvider = {
  service: 'M365',
  workflowName: 'm365-onboarding-v1',
  run: async (employee: EmployeeRow, options?: ProvisioningOptions) => {
    const config = getConfig();

    // Log configuration for debugging
    console.log('[M365 Provider] Starting provisioning', {
      employeeId: employee.id,
      employeeName: `${employee.first_name} ${employee.last_name}`,
      department: employee.department,
      hasOptions: !!options,
      selectedMailboxesCount: options?.selectedMailboxes?.length || 0,
      selectedGroupIdsCount: options?.selectedGroupIds?.length || 0,
      configuredMailboxes: {
        trading: config.sharedMailboxes.trading,
        byDepartment: config.sharedMailboxes.byDepartment[employee.department],
      },
      securityGroupCount: config.securityGroupIds.length,
    });

    // Graph token — used for user creation, licence assignment, and M365 Group membership.
    const graphToken = await getAccessToken(config, 'https://graph.microsoft.com/.default');

    // EXO token — used for Exchange shared mailbox permission grants.
    // Requires Exchange.ManageAsApp app permission on the Entra app registration.
    const exoToken = await getAccessToken(config, 'https://outlook.office365.com/.default');

    const logs: Array<{ step: string; status: 'done' | 'pending' | 'error'; timestamp: string }> = [];
    const nonFatalErrors: string[] = [];

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

    const manualMailboxSelectionProvided = options?.selectedMailboxes !== undefined;
    const configuredMailboxTargets = [
      config.sharedMailboxes.trading,
      config.sharedMailboxes.byDepartment[employee.department],
    ];
    const mailboxTargets = manualMailboxSelectionProvided
      ? (options?.selectedMailboxes || [])
      : configuredMailboxTargets;
    const uniqueMailboxTargets = [...new Set(mailboxTargets.map((mailbox) => mailbox.trim()).filter(Boolean))];

    console.log('[M365 Provider] Mailbox assignment details', {
      manualSelectionProvided: manualMailboxSelectionProvided,
      configuredTargets: configuredMailboxTargets,
      selectedMailboxes: options?.selectedMailboxes,
      uniqueTargets: uniqueMailboxTargets,
      targetCount: uniqueMailboxTargets.length,
    });

    if (uniqueMailboxTargets.length > 0) {
      for (const mailboxEmail of uniqueMailboxTargets) {
        console.log('[M365 Provider] Attempting mailbox assignment', { mailboxEmail, userUpn: user.userPrincipalName });
        try {
          const mailboxResult = await addUserToSharedMailbox(
            exoToken,
            config.tenantId,
            mailboxEmail,
            user.userPrincipalName,
          );
          console.log('[M365 Provider] Mailbox assignment succeeded', { mailboxEmail, ...mailboxResult });
          logs.push({
            step:
              mailboxResult.status === 'added'
                ? `Granted FullAccess on shared mailbox ${mailboxEmail} (attempts: ${mailboxResult.attempts}; latencyMs: ${mailboxResult.latencyMs})`
                : `User already has FullAccess on shared mailbox ${mailboxEmail} (attempts: ${mailboxResult.attempts}; latencyMs: ${mailboxResult.latencyMs})`,
            status: 'done',
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : `Failed mailbox assignment for ${mailboxEmail}`;
          console.error('[M365 Provider] Mailbox assignment failed', { mailboxEmail, error: message });
          nonFatalErrors.push(message);
          logs.push({
            step: `Shared mailbox assignment failed for ${mailboxEmail}: ${message}`,
            status: 'error',
            timestamp: new Date().toISOString(),
          });
        }
      }
    } else {
      logs.push({
        step: manualMailboxSelectionProvided
          ? 'Skipped shared mailbox assignment (no mailboxes selected)'
          : 'Skipped shared mailbox assignment (no configured mailboxes)',
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    }

    if (config.defaultGroupId) {
      try {
        const membership = await addUserToGroup(graphToken, user.id, config.defaultGroupId);
        logs.push({
          step:
            membership === 'added'
              ? 'Added user to Cores SharePoint site (cores_algemeen)'
              : 'User already in Cores SharePoint site (cores_algemeen)',
          status: 'done',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Default SharePoint group assignment failed';
        nonFatalErrors.push(message);
        logs.push({
          step: `Default SharePoint group assignment failed: ${message}`,
          status: 'error',
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      logs.push({
        step: 'Skipped default SharePoint group assignment (MS_GRAPH_DEFAULT_GROUP_ID not configured)',
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    }

    if (config.defaultSiteId) {
      try {
        const siteFavorited = await favoriteSharePointSite(graphToken, user.id, config.defaultSiteId);
        logs.push({
          step:
            siteFavorited === 'added'
              ? 'Favorited default SharePoint site'
              : 'SharePoint site already favorited',
          status: 'done',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'SharePoint site favoriting failed';
        nonFatalErrors.push(message);
        logs.push({
          step: `SharePoint site favoriting failed: ${message}`,
          status: 'error',
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      logs.push({
        step: 'Skipped SharePoint site favoriting (MS_GRAPH_DEFAULT_SITE_ID not configured)',
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    }

    const manualSecurityGroupsProvided = options?.selectedGroupIds !== undefined;
    const securityGroupIds = manualSecurityGroupsProvided
      ? (options?.selectedGroupIds || [])
      : config.securityGroupIds;

    if (securityGroupIds.length > 0) {
      const sgResult = await addUserToSecurityGroups(graphToken, user.id, securityGroupIds);
      logs.push(...sgResult.logs);
      nonFatalErrors.push(...sgResult.errors);
    } else {
      logs.push({
        step: manualSecurityGroupsProvided
          ? 'Skipped security group assignment (no groups selected)'
          : 'Skipped security group assignment (MS_GRAPH_SECURITY_GROUP_IDS not configured)',
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    }

    console.log('[M365 Provider] Provisioning completed', {
      successCount: logs.filter(l => l.status === 'done').length,
      errorCount: logs.filter(l => l.status === 'error').length,
      nonFatalErrorsCount: nonFatalErrors.length,
    });

    if (nonFatalErrors.length > 0) {
      throw new Error(`Provisioning completed with assignment errors: ${nonFatalErrors.join(' | ')}`);
    }

    return logs;
  },
};
