// `vercel dev` loads `.env.local` automatically, and production env vars come
// from the Vercel project settings -- no dotenv wiring needed here, unlike
// the old standalone Express server.

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  aiDmModel: required("AI_DM_MODEL", "claude-sonnet-5"),
  jwtSecret: required("JWT_SECRET", "dev-only-insecure-secret"),
};

if (!env.anthropicApiKey) {
  console.warn(
    "[env] ANTHROPIC_API_KEY is not set -- the AI DM service will fail until it is configured"
  );
}
