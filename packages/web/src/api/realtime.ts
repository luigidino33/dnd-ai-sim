import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Anon-key client, browser-side only. RLS grants it read-only SELECT on
 * sessions/characters/event_logs (see supabase/schema.sql) -- all writes go
 * through the /api/* serverless functions using the service-role key.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
  }
  return client;
}
