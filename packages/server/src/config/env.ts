import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// Always load the monorepo-root .env, regardless of the process's cwd --
// `npm run dev` runs this from packages/server, where dotenv/config's default
// (cwd-relative) lookup would miss the root .env entirely.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  mongodbUri: required("MONGODB_URI", "mongodb://localhost:27017/dnd-ai-sim"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  aiDmModel: required("AI_DM_MODEL", "claude-sonnet-5"),
  jwtSecret: required("JWT_SECRET", "dev-only-insecure-secret"),
  serverPort: Number(process.env.SERVER_PORT ?? 4000),
  webOrigin: required("WEB_ORIGIN", "http://localhost:5173"),
};

if (!env.anthropicApiKey) {
  console.warn(
    "[env] ANTHROPIC_API_KEY is not set — the AI DM service will fail until it is configured in .env"
  );
}
