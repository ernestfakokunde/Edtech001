import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
  console.warn('[config] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set; uploads will be unavailable.')
}

export const supabase = createClient(
  env.supabaseUrl ?? 'https://placeholder.supabase.co',
  env.supabaseServiceRoleKey ?? 'placeholder-service-role-key',
  { auth: { autoRefreshToken: false, persistSession: false } },
)