import type { Server, Socket } from "socket.io";
import { CharacterModel } from "../../db/models/Character.js";

type Ack = (response: { ok: true; [key: string]: unknown } | { ok: false; error: string }) => void;

/** Binds this socket to the player's character so the server can gate action/roll submission to "your turn only". */
export function registerCharacterHandlers(_io: Server, socket: Socket) {
  socket.on("character:claim", async (payload: { characterId: string }, ack?: Ack) => {
    try {
      const character = await CharacterModel.findById(payload.characterId);
      if (!character) throw new Error("Character not found");
      if (!socket.data.auth?.isAdmin && String(character.playerId) !== socket.data.auth?.userId) {
        throw new Error("This character does not belong to you");
      }
      socket.data.characterId = payload.characterId;
      ack?.({ ok: true, character });
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message });
    }
  });
}
