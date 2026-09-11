import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth } from "../_lib/auth/requireAuth.js";
import { CharacterValidationError, createCharacter, type CreateCharacterInput } from "../_lib/services/characterService.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const auth = getAuth(req);
  const body = readBody<Omit<CreateCharacterInput, "campaignId" | "playerId">>(req);
  try {
    const character = await createCharacter({ ...body, campaignId: auth.campaignId, playerId: auth.userId });
    res.status(201).json(character);
  } catch (err) {
    if (err instanceof CharacterValidationError) throw new HttpError(400, err.message);
    throw err;
  }
});
