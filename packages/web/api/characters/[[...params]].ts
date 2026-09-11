import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth } from "../_lib/auth/requireAuth.js";
import {
  CharacterValidationError,
  createCharacter,
  getCharacter,
  listCharactersForCampaign,
  updateCharacterOverrides,
  type CreateCharacterInput,
} from "../_lib/services/characterService.js";

// Consolidated into one catch-all function (was 3 separate files) to stay
// well under Vercel's per-deployment Serverless Function count limit.
// Routes: POST /api/characters, GET|PATCH /api/characters/:id, GET /api/characters/campaign/:campaignId
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const params = ([] as string[]).concat((req.query.params as string[] | undefined) ?? []);
  const auth = getAuth(req);

  if (params.length === 0) {
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
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

  if (params.length === 2 && params[0] === "campaign") {
    if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
    const characters = await listCharactersForCampaign(params[1]);
    res.json(characters);
    return;
  }

  if (params.length === 1) {
    const id = params[0];
    if (req.method === "GET") {
      const character = await getCharacter(id);
      if (!character) throw new HttpError(404, "Character not found");
      res.json(character);
      return;
    }
    if (req.method === "PATCH") {
      try {
        const character = await updateCharacterOverrides(id, readBody(req));
        res.json(character);
      } catch (err) {
        if (err instanceof CharacterValidationError) throw new HttpError(400, err.message);
        throw err;
      }
      return;
    }
    throw new HttpError(405, "Method not allowed");
  }

  throw new HttpError(404, "Not found");
});
