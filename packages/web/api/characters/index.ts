import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth } from "../_lib/auth/requireAuth.js";
import {
  CharacterValidationError,
  createCharacter,
  listCharactersForCampaign,
  type CreateCharacterInput,
} from "../_lib/services/characterService.js";

// Routes: POST /api/characters (create), GET /api/characters?campaignId=... (roster)
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const auth = getAuth(req);

  if (req.method === "GET") {
    const campaignId = (req.query.campaignId as string) ?? auth.campaignId;
    const characters = await listCharactersForCampaign(campaignId);
    res.json(characters);
    return;
  }

  if (req.method === "POST") {
    const body = readBody<Omit<CreateCharacterInput, "campaignId" | "playerId">>(req);
    try {
      const character = await createCharacter({ ...body, campaignId: auth.campaignId, playerId: auth.userId });
      res.status(201).json(character);
    } catch (err) {
      if (err instanceof CharacterValidationError) throw new HttpError(400, err.message);
      throw err;
    }
    return;
  }

  throw new HttpError(405, "Method not allowed");
});
