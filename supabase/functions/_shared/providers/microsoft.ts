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
  tradingSharedMailboxGroupId: string | null;
  sharedMailboxGroupByDepartment: Record<EmployeeRow['department'], string | null>;
}

interface GraphUser {
  id: string;
  userPrincipalName: string;
}

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

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

const getConfig = (): MicrosoftGraphConfig => ({
  tenantId: getRequiredEnv('MS_GRAPH_TENANT_ID'),
  clientId: getRequiredEnv('MS_GRAPH_CLIENT_ID'),
  clientSecret: getRequiredEnv('MS_GRAPH_CLIENT_SECRET'),
  domain: getRequiredEnv('MS_GRAPH_DOMAIN'),
  usageLocation: Deno.env.get('MS_GRAPH_USAGE_LOCATION') || 'NL',
  businessPremiumSkuId: Deno.env.get('MS_GRAPH_BUSINESS_PREMIUM_SKU_ID') || null,
  defaultGroupId: Deno.env.get('MS_GRAPH_DEFAULT_GROUP_ID') || null,
  tradingSharedMailboxGroupId: Deno.env.get('MS_GRAPH_SHARED_MAILBOX_GROUP_TRADING') || null,
  sharedMailboxGroupByDepartment: {
    Sales: Deno.env.get('MS_GRAPH_SHARED_MAILBOX_GROUP_SALES') || null,
    'Customs & Compliance': Deno.env.get('MS_GRAPH_SHARED_MAILBOX_GROUP_CUSTOMS') || null,
    Transport: Deno.env.get('MS_GRAPH_SHARED_MAILBOX_GROUP_TRANSPORT') || null,
  },
});

const readGraphError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    const message = payload?.error?.message;
    if (message) {
      return message;
    }
  } catch {
    // Ignore malformed JSON and fall back to status text.
  }
  return `${response.status} ${response.statusText}`;
};

const getAccessToken = async (config: MicrosoftGraphConfig): Promise<string> => {
  const tokenEndpoint = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default',
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`Failed to acquire Graph token: ${await readGraphError(response)}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('Graph token response did not include an access token');
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

export const microsoftProvider: ProvisioningProvider = {
  service: 'M365',
  workflowName: 'm365-onboarding-v1',
  run: async (employee: EmployeeRow) => {
    const config = getConfig();
    const accessToken = await getAccessToken(config);
    const logs: Array<{ step: string; status: 'done' | 'pending' | 'error'; timestamp: string }> = [];

    const { user, reused } = await createOrReuseUser(accessToken, config, employee);
    logs.push({
      step: reused
        ? `Reused existing M365 user ${user.userPrincipalName}`
        : `Created M365 account ${user.userPrincipalName}`,
      status: 'done',
      timestamp: new Date().toISOString(),
    });

    if (config.businessPremiumSkuId) {
      await ensureUsageLocation(accessToken, user.id, config.usageLocation);
      await assignBusinessPremiumLicense(accessToken, user.id, config.businessPremiumSkuId);
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

    if (config.tradingSharedMailboxGroupId) {
      const membership = await addUserToGroup(accessToken, user.id, config.tradingSharedMailboxGroupId);
      logs.push({
        step:
          membership === 'added'
            ? 'Added user to shared mailbox group (trading@cores.nl)'
            : 'User already in shared mailbox group (trading@cores.nl)',
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    } else {
      logs.push({
        step: 'Skipped shared mailbox group (trading@cores.nl) (group ID not configured)',
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    }

    const sharedMailboxGroupId = config.sharedMailboxGroupByDepartment[employee.department];
    if (sharedMailboxGroupId) {
      const membership = await addUserToGroup(accessToken, user.id, sharedMailboxGroupId);
      logs.push({
        step:
          membership === 'added'
            ? `Added user to department mailbox group (${employee.department})`
            : `User already in department mailbox group (${employee.department})`,
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    } else {
      logs.push({
        step: `Skipped department mailbox group for ${employee.department} (group ID not configured)`,
        status: 'done',
        timestamp: new Date().toISOString(),
      });
    }

    if (config.defaultGroupId) {
      const membership = await addUserToGroup(accessToken, user.id, config.defaultGroupId);
      logs.push({
        step:
          membership === 'added'
            ? 'Added user to default SharePoint/M365 group'
            : 'User already in default SharePoint/M365 group',
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
