/**
 * Server-only Supabase client. The service role key must never reach the browser.
 */
import { createClient } from '@supabase/supabase-js';

import { env } from './env.js';

export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
