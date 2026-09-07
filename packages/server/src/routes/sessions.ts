import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { getSession, startSession } from "../services/turnEngine.js";
import { getAllEvents } from "../services/eventLogService.js";
import { listCharactersForCampaign } from "../services/characterService.js";
import { SessionModel } from "../db/models/Session.js";

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

/** The campaign's current live/paused session, if any — lets a player's client find the session to join without the Admin sharing a link. */
sessionsRouter.get("/campaign/:campaignId/current", async (req, res) => {
  const session = await SessionModel.findOne({
    campaignId: req.params.campaignId,
    status: { $ne: "ended" },
  }).sort({ createdAt: -1 });
  res.json(session ?? null);
});

/** Admin starts a new live session; the turn queue defaults to the full campaign roster. */
sessionsRouter.post("/", requireAdmin, async (req, res) => {
  const { characterIds } = req.body ?? {};
  const ids: string[] =
    Array.isArray(characterIds) && characterIds.length > 0
      ? characterIds
      : (await listCharactersForCampaign(req.auth!.campaignId)).map((c) => String(c._id));

  if (ids.length === 0) {
    res.status(400).json({ error: "Campaign has no characters yet -- create at least one before starting a session." });
    return;
  }

  const session = await startSession(req.auth!.campaignId, ids);
  res.status(201).json(session);
});

sessionsRouter.get("/:id", async (req, res) => {
  const session = await getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  res.json(session);
});

sessionsRouter.get("/:id/events", async (req, res) => {
  const events = await getAllEvents(req.params.id);
  res.json(events);
});
