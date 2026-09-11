import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth } from "../_lib/auth/requireAuth.js";
import {
  CharacterValidationError,
  getCharacter,
  listCharactersForCampaign,
  updateCharacterOverrides,
} from "../_lib/services/characterService.js";

// Required catch-all (1+ segments) -- the bare POST /api/characters route
// lives in index.ts (see campaigns/[...params].ts for why this isn't one
// optional-catch-all file).
// Routes: GET|PATCH /api/characters/:id, GET /api/characters/campaign/:campaignId
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const params = ([] as string[]).concat((req.query.params as string[] | undefined) ?? []);
  getAuth(req);

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
