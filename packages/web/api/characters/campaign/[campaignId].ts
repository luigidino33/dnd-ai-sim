import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, HttpError } from "../../_lib/http.js";
import { getAuth } from "../../_lib/auth/requireAuth.js";
import { listCharactersForCampaign } from "../../_lib/services/characterService.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
  getAuth(req);
  const campaignId = req.query.campaignId as string;
  const characters = await listCharactersForCampaign(campaignId);
  res.json(characters);
});
