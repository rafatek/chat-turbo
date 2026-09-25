import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with the SERVICE ROLE KEY.
 * WARNING: This bypasses Row Level Security (RLS).
 * Only use this in secure server-side environments (Server Actions/Route Handlers)
 * where you explicitly need to bypass RLS (e.g., admin operations).
 */
export async function createAdminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!, // Key that bypasses RLS
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )
}
