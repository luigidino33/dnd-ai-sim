import type { VercelRequest } from "@vercel/node";
import { HttpError } from "../http.js";
import { getCharacter } from "../services/characterService.js";
import { verifySessionToken, type SessionTokenPayload } from "./jwt.js";

export function getAuth(req: VercelRequest): SessionTokenPayload {
  const header = req.headers.authorization;
  const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) throw new HttpError(401, "Missing Authorization bearer token");
  try {
    return verifySessionToken(token);
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
}

export function requireAdmin(auth: SessionTokenPayload) {
  if (!auth.isAdmin) throw new HttpError(403, "Admin permission required");
}

/** Admin may act on any character (table-driving/testing); a player may only act on their own. */
export async function assertOwnsCharacterOrAdmin(auth: SessionTokenPayload, characterId: string) {
  if (auth.isAdmin) return;
  const character = await getCharacter(characterId);
  if (!character || character.playerId !== auth.userId) {
    throw new HttpError(403, "This character does not belong to you");
  }
}
