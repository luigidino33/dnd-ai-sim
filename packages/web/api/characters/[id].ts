import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth } from "../_lib/auth/requireAuth.js";
import { CharacterValidationError, getCharacter, updateCharacterOverrides } from "../_lib/services/characterService.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  getAuth(req);
  const id = req.query.id as string;

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
});
