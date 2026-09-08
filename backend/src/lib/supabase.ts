import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

export const supabase = env.supabaseUrl && env.supabaseAnonKey
  ? createClient(env.supabaseUrl, env.supabaseAnonKey)
  : null

// Keep the service-role client separate and server-only. Never expose this key to the frontend.
export const supabaseAdmin = env.supabaseUrl && env.supabaseServiceRoleKey
  ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null
