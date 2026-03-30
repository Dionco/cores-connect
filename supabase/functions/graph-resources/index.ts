import {
  getAccessToken,
  getConfig,
  listSecurityGroups,
  listSharedMailboxesWithFallback,
} from '../_shared/providers/microsoft.ts';

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const config = getConfig();
    const graphToken = await getAccessToken(config, 'https://graph.microsoft.com/.default');
    const exoToken = await getAccessToken(config, 'https://outlook.office365.com/.default');

    const [sharedMailboxesResult, securityGroupsResult] = await Promise.allSettled([
      listSharedMailboxesWithFallback(config, graphToken, exoToken),
      listSecurityGroups(graphToken),
    ]);

    const sharedMailboxes = sharedMailboxesResult.status === 'fulfilled' ? sharedMailboxesResult.value : [];
    const securityGroups = securityGroupsResult.status === 'fulfilled' ? securityGroupsResult.value : [];

    if (sharedMailboxesResult.status === 'rejected') {
      console.error('Shared mailbox lookup failed', sharedMailboxesResult.reason);
    }

    if (securityGroupsResult.status === 'rejected') {
      console.error('Security group lookup failed', securityGroupsResult.reason);
    }

    return jsonResponse(200, {
      sharedMailboxes,
      securityGroups,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return jsonResponse(500, { error: message });
  }
});
