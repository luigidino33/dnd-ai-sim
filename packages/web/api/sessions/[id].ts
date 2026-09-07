import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, HttpError } from "../_lib/http.js";
import { getAuth } from "../_lib/auth/requireAuth.js";
import { getSession } from "../_lib/services/turnEngine.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
  getAuth(req);
  const id = req.query.id as string;
  const session = await getSession(id);
  if (!session) throw new HttpError(404, "Session not found");
  res.json(session);
});
