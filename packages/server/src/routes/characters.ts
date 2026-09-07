import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  CharacterValidationError,
  createCharacter,
  getCharacter,
  listCharactersForCampaign,
  updateCharacterOverrides,
} from "../services/characterService.js";

export const charactersRouter = Router();

charactersRouter.use(requireAuth);

charactersRouter.get("/campaign/:campaignId", async (req, res) => {
  const characters = await listCharactersForCampaign(req.params.campaignId);
  res.json(characters);
});

charactersRouter.get("/:id", async (req, res) => {
  const character = await getCharacter(req.params.id);
  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.json(character);
});

charactersRouter.post("/", async (req, res) => {
  try {
    const character = await createCharacter({
      ...req.body,
      campaignId: req.auth!.campaignId,
      playerId: req.auth!.userId,
    });
    res.status(201).json(character);
  } catch (err) {
    if (err instanceof CharacterValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

charactersRouter.patch("/:id", async (req, res) => {
  try {
    const character = await updateCharacterOverrides(req.params.id, req.body);
    res.json(character);
  } catch (err) {
    if (err instanceof CharacterValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});
