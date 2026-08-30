import { Router } from "express";
import { findWidgetById } from "./widgets.repository";
import { toPublicConfig } from "./widgets.config";

export const configRouter = Router();

configRouter.get("/:id/config", async (req, res) => {
  const widget = await findWidgetById(req.params.id);
  if (!widget) {
    return res.status(404).json({ error: "Widget not found" });
  }

  // Cache for 60s — visitors reuse this without re-hitting the DB.
  res.set("Cache-Control", "public, max-age=60");
  res.json(toPublicConfig(widget));
});