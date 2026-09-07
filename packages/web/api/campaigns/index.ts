import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { createCampaign } from "../_lib/services/campaignService.js";

/** Bootstraps the single ongoing campaign (requirement 5.4). No auth required -- this is the entry point before any invite code exists. */
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const { name, dmTone } = readBody<{ name?: string; dmTone?: string }>(req);
  if (typeof name !== "string" || !name.trim()) throw new HttpError(400, "name is required");

  const campaign = await createCampaign(name.trim(), dmTone);
  res.status(201).json(campaign);
});
