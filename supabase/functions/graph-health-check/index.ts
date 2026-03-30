declare const Deno: {
  env: {
    get: (name: string) => string | undefined;
  };
  serve: (handler: (req: Request) => Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

interface HealthCheckResult {
  ok: boolean;
  checks: {
    token: { ok: boolean; message: string };
    exoToken: { ok: boolean; message: string };
    sku: { ok: boolean; message: string; skuId: string | null };
    sharedMailboxes: Array<{ key: string; mailbox: string | null; ok: boolean; message: string }>;
    groups: Array<{ key: string; groupId: string | null; ok: boolean; message: string }>;
  };
}

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

const getRequiredEnv = (name: string): string => {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const readGraphError = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message || `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
};

const getAccessToken = async () => {
  const tenantId = getRequiredEnv('MS_GRAPH_TENANT_ID');
  const clientId = getRequiredEnv('MS_GRAPH_CLIENT_ID');
  const clientSecret = getRequiredEnv('MS_GRAPH_CLIENT_SECRET');

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
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
    throw new Error(`Token check failed: ${await readGraphError(response)}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('Token check failed: missing access_token');
  }

  return payload.access_token;
};

const getExoAccessToken = async () => {
  const tenantId = getRequiredEnv('MS_GRAPH_TENANT_ID');
  const clientId = getRequiredEnv('MS_GRAPH_CLIENT_ID');
  const clientSecret = getRequiredEnv('MS_GRAPH_CLIENT_SECRET');

  const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: 'https://outlook.office365.com/.default',
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`EXO token check failed: ${await readGraphError(response)}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error('EXO token check failed: missing access_token');
  }

  return payload.access_token;
};

const isLikelyEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const checkSharedMailboxConfig = (domain: string) => {
  const checks: Array<{ key: string; mailbox: string | null; ok: boolean; message: string }> = [];

  const configured = [
    {
      key: 'MS_EXO_SHARED_MAILBOX_TRADING',
      mailbox: Deno.env.get('MS_EXO_SHARED_MAILBOX_TRADING') || `trading@${domain}`,
    },
    {
      key: 'MS_EXO_SHARED_MAILBOX_SALES',
      mailbox: Deno.env.get('MS_EXO_SHARED_MAILBOX_SALES') || `sales@${domain}`,
    },
    {
      key: 'MS_EXO_SHARED_MAILBOX_CUSTOMS',
      mailbox: Deno.env.get('MS_EXO_SHARED_MAILBOX_CUSTOMS') || `customs@${domain}`,
    },
    {
      key: 'MS_EXO_SHARED_MAILBOX_TRANSPORT',
      mailbox: Deno.env.get('MS_EXO_SHARED_MAILBOX_TRANSPORT') || `transport@${domain}`,
    },
  ];

  for (const entry of configured) {
    if (!entry.mailbox) {
      checks.push({
        key: entry.key,
        mailbox: null,
        ok: false,
        message: 'Missing shared mailbox value',
      });
      continue;
    }

    checks.push({
      key: entry.key,
      mailbox: entry.mailbox,
      ok: isLikelyEmail(entry.mailbox),
      message: isLikelyEmail(entry.mailbox)
        ? 'Mailbox format looks valid'
        : 'Mailbox value is not a valid email address',
    });
  }

  return checks;
};

const graphHeaders = (accessToken: string): HeadersInit => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
});

const checkGroupExists = async (accessToken: string, groupId: string) => {
  const response = await fetch(
    `${GRAPH_BASE_URL}/groups/${encodeURIComponent(groupId)}?$select=id,displayName`,
    {
      method: 'GET',
      headers: graphHeaders(accessToken),
    },
  );

  if (!response.ok) {
    return { ok: false, message: await readGraphError(response) };
  }

  const payload = (await response.json()) as { displayName?: string };
  return {
    ok: true,
    message: payload.displayName
      ? `Found group: ${payload.displayName}`
      : 'Found group',
  };
};

const checkSkuVisibility = async (accessToken: string, expectedSkuId: string | null) => {
  const response = await fetch(`${GRAPH_BASE_URL}/subscribedSkus?$select=skuId,skuPartNumber`, {
    method: 'GET',
    headers: graphHeaders(accessToken),
  });

  if (!response.ok) {
    return {
      ok: false,
      message: await readGraphError(response),
      skuId: expectedSkuId,
    };
  }

  const payload = (await response.json()) as {
    value?: Array<{ skuId: string; skuPartNumber: string }>;
  };

  const rows = payload.value || [];

  if (!expectedSkuId) {
    return {
      ok: true,
      message: 'No SKU configured (MS_GRAPH_BUSINESS_PREMIUM_SKU_ID not set)',
      skuId: null,
    };
  }

  const found = rows.find((row) => row.skuId.toLowerCase() === expectedSkuId.toLowerCase());
  if (!found) {
    return {
      ok: false,
      message: `Configured SKU not found in tenant subscriptions: ${expectedSkuId}`,
      skuId: expectedSkuId,
    };
  }

  return {
    ok: true,
    message: `Found configured SKU: ${found.skuPartNumber}`,
    skuId: expectedSkuId,
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const accessToken = await getAccessToken();
    await getExoAccessToken();
    const graphDomain = getRequiredEnv('MS_GRAPH_DOMAIN');
    const skuCheck = await checkSkuVisibility(
      accessToken,
      Deno.env.get('MS_GRAPH_BUSINESS_PREMIUM_SKU_ID') || null,
    );
    const sharedMailboxChecks = checkSharedMailboxConfig(graphDomain);

    const groupConfig: Array<{ key: string; value: string | null }> = [
      { key: 'MS_GRAPH_DEFAULT_GROUP_ID', value: Deno.env.get('MS_GRAPH_DEFAULT_GROUP_ID') || null },
      {
        key: 'MS_GRAPH_SHARED_MAILBOX_GROUP_TRADING',
        value: Deno.env.get('MS_GRAPH_SHARED_MAILBOX_GROUP_TRADING') || null,
      },
      {
        key: 'MS_GRAPH_SHARED_MAILBOX_GROUP_SALES',
        value: Deno.env.get('MS_GRAPH_SHARED_MAILBOX_GROUP_SALES') || null,
      },
      {
        key: 'MS_GRAPH_SHARED_MAILBOX_GROUP_CUSTOMS',
        value: Deno.env.get('MS_GRAPH_SHARED_MAILBOX_GROUP_CUSTOMS') || null,
      },
      {
        key: 'MS_GRAPH_SHARED_MAILBOX_GROUP_TRANSPORT',
        value: Deno.env.get('MS_GRAPH_SHARED_MAILBOX_GROUP_TRANSPORT') || null,
      },
    ];

    const groupChecks = await Promise.all(
      groupConfig.map(async (entry) => {
        if (!entry.value) {
          return {
            key: entry.key,
            groupId: null,
            ok: true,
            message: 'Not configured (optional)',
          };
        }

        const groupCheck = await checkGroupExists(accessToken, entry.value);
        return {
          key: entry.key,
          groupId: entry.value,
          ok: groupCheck.ok,
          message: groupCheck.message,
        };
      }),
    );

    const result: HealthCheckResult = {
      ok: skuCheck.ok
        && groupChecks.every((check) => check.ok)
        && sharedMailboxChecks.every((check) => check.ok),
      checks: {
        token: { ok: true, message: 'Successfully acquired Graph token' },
        exoToken: {
          ok: true,
          message: 'Successfully acquired Exchange Online token',
        },
        sku: skuCheck,
        sharedMailboxes: sharedMailboxChecks,
        groups: groupChecks,
      },
    };

    return jsonResponse(200, result as unknown as Record<string, unknown>);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse(500, {
      ok: false,
      checks: {
        token: { ok: false, message },
        exoToken: { ok: false, message },
      },
    });
  }
});
