import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

/**
 * Service-role client for use inside serverless functions only -- it
 * bypasses Row Level Security, so every handler that uses it must do its own
 * JWT-based authorization (see requireAuth.ts) exactly like the old Express
 * middleware did. Never send this client or its key to the browser.
 */
export function getServiceClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}
