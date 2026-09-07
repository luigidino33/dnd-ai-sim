import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, HttpError } from "../../_lib/http.js";
import { getAuth } from "../../_lib/auth/requireAuth.js";
import { getAllEvents } from "../../_lib/services/eventLogService.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
  getAuth(req);
  const id = req.query.id as string;
  const events = await getAllEvents(id);
  res.json(events);
});
