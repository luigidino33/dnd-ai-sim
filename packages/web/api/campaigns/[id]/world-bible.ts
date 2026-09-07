import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../../_lib/http.js";
import { getAuth, requireAdmin } from "../../_lib/auth/requireAuth.js";
import { updateWorldBible } from "../../_lib/services/campaignService.js";
import type { WorldBible } from "@dnd-ai-sim/shared";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "PATCH") throw new HttpError(405, "Method not allowed");
  const auth = getAuth(req);
  requireAdmin(auth);
  const id = req.query.id as string;

  const worldBible = readBody<WorldBible>(req);
  const campaign = await updateWorldBible(id, worldBible);
  res.json(campaign);
});
