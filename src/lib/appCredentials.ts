import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export interface AppCredential {
  id: string;
  employeeId: string;
  appName: string;
  loginUrl: string | null;
  username: string | null;
  notes: string | null;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertAppCredentialInput {
  id?: string;
  employeeId: string;
  appName: string;
  loginUrl?: string | null;
  username?: string | null;
  notes?: string | null;
  password?: string | null; // optional plaintext, set/changed via RPC
}

const MOCK_KEY = 'cores:app-credentials';

interface MockRow extends AppCredential {
  password?: string;
}

const readMock = (): MockRow[] => {
  try {
    return JSON.parse(localStorage.getItem(MOCK_KEY) || '[]') as MockRow[];
  } catch {
    return [];
  }
};

const writeMock = (rows: MockRow[]) => {
  localStorage.setItem(MOCK_KEY, JSON.stringify(rows));
};

const ensureSupabase = () => {
  if (!isSupabaseConfigured || !supabase) throw new Error('supabase-not-configured');
  return supabase;
};

export const listAppCredentials = async (employeeId: string): Promise<AppCredential[]> => {
  if (!isSupabaseConfigured || !supabase) {
    return readMock()
      .filter((r) => r.employeeId === employeeId)
      .map(({ password: _password, ...rest }) => ({ ...rest, hasPassword: Boolean(_password) }));
  }

  const { data, error } = await supabase
    .from('employee_app_credentials')
    .select('id, employee_id, app_name, login_url, username, notes, password_encrypted, created_at, updated_at')
    .eq('employee_id', employeeId)
    .order('app_name', { ascending: true });

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    appName: row.app_name,
    loginUrl: row.login_url,
    username: row.username,
    notes: row.notes,
    hasPassword: Boolean(row.password_encrypted),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const upsertAppCredential = async (input: UpsertAppCredentialInput): Promise<AppCredential> => {
  if (!isSupabaseConfigured || !supabase) {
    const rows = readMock();
    let row: MockRow;
    if (input.id) {
      const idx = rows.findIndex((r) => r.id === input.id);
      if (idx === -1) throw new Error('Not found');
      row = {
        ...rows[idx],
        appName: input.appName,
        loginUrl: input.loginUrl ?? null,
        username: input.username ?? null,
        notes: input.notes ?? null,
        password: input.password ?? rows[idx].password,
        updatedAt: new Date().toISOString(),
      };
      rows[idx] = row;
    } else {
      row = {
        id: crypto.randomUUID(),
        employeeId: input.employeeId,
        appName: input.appName,
        loginUrl: input.loginUrl ?? null,
        username: input.username ?? null,
        notes: input.notes ?? null,
        password: input.password ?? undefined,
        hasPassword: Boolean(input.password),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      rows.push(row);
    }
    writeMock(rows);
    const { password: _password, ...rest } = row;
    return { ...rest, hasPassword: Boolean(_password) };
  }

  const client = ensureSupabase();
  let credentialId = input.id;

  if (credentialId) {
    const { error } = await client
      .from('employee_app_credentials')
      .update({
        app_name: input.appName,
        login_url: input.loginUrl ?? null,
        username: input.username ?? null,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', credentialId);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await client
      .from('employee_app_credentials')
      .insert({
        employee_id: input.employeeId,
        app_name: input.appName,
        login_url: input.loginUrl ?? null,
        username: input.username ?? null,
        notes: input.notes ?? null,
      })
      .select('id')
      .single();
    if (error || !data) throw new Error(error?.message || 'Insert failed');
    credentialId = data.id;
  }

  if (input.password && input.password.length > 0) {
    const { error } = await client.rpc('set_app_credential_password', {
      cred_id: credentialId,
      plaintext: input.password,
    });
    if (error) throw new Error(error.message);
  }

  const { data, error } = await client
    .from('employee_app_credentials')
    .select('id, employee_id, app_name, login_url, username, notes, password_encrypted, created_at, updated_at')
    .eq('id', credentialId)
    .single();
  if (error || !data) throw new Error(error?.message || 'Fetch failed');

  return {
    id: data.id,
    employeeId: data.employee_id,
    appName: data.app_name,
    loginUrl: data.login_url,
    username: data.username,
    notes: data.notes,
    hasPassword: Boolean(data.password_encrypted),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
};

export const deleteAppCredential = async (id: string): Promise<void> => {
  if (!isSupabaseConfigured || !supabase) {
    writeMock(readMock().filter((r) => r.id !== id));
    return;
  }
  const { error } = await supabase.from('employee_app_credentials').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

export const revealAppCredentialPassword = async (id: string): Promise<string> => {
  if (!isSupabaseConfigured || !supabase) {
    const row = readMock().find((r) => r.id === id);
    if (!row?.password) throw new Error('No password set');
    return row.password;
  }
  const { data, error } = await supabase.rpc('reveal_app_credential_password', { cred_id: id });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('No password set');
  return data as string;
};
