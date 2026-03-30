import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabaseLegacyAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseKey = supabasePublishableKey || supabaseLegacyAnonKey;
const isPlaceholderSupabaseUrl =
  !supabaseUrl || supabaseUrl.includes('your-project-ref.supabase.co');

export const isSupabaseConfigured = Boolean(!isPlaceholderSupabaseUrl && supabaseKey);
export const supabaseFunctionBaseUrl = isSupabaseConfigured ? `${supabaseUrl}/functions/v1` : '';
export const supabasePublishableClientKey = supabaseKey || '';

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const getSupabaseRedirectUrl = () =>
  import.meta.env.VITE_SUPABASE_AUTH_REDIRECT_URL || window.location.origin;
