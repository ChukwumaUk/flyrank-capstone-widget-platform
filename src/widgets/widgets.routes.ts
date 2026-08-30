import { Router } from "express";
import { createWidgetSchema } from "./widgets.schema";
import { createWidget } from "./widgets.service";
import { z } from "zod";
import { findWidgetsByOwner, findWidgetByIdForOwner, updateWidgetForOwner, deleteWidgetForOwner } from "./widgets.repository";
import {
  findSubmissionsForOwnerWidget,
  findStatsForOwnerWidget,
} from "../submissions/submissions.repository";

export const widgetsRouter = Router();

widgetsRouter.post("/", async (req, res) => {
  // 1. Validate the incoming body at the boundary.
  const parsed = createWidgetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid widget", details: parsed.error.issues });
  }

  // 2. Identity comes from auth, NOT the body. (Placeholder until we add real auth.)
  const owner_id = req.user!.id;

  // 3. Call the service with validated input + the owner from auth.
  const widget = await createWidget({ ...parsed.data, owner_id });

  // 4. Respond 201 with the created widget.
  res.status(201).json(widget);
});



// Zod Schema for updating a widget
const updateWidgetSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  config: z.record(z.string(), z.any()).optional(),
  allowed_origins: z.array(z.string()).optional(),
});

// GET /api/widgets - List all widgets for current user
widgetsRouter.get("/", async (req, res) => {
  const widgets = await findWidgetsByOwner(req.user!.id);
  res.json(widgets);
});

// GET /api/widgets/:id - Get specific widget if owned
widgetsRouter.get("/:id", async (req, res) => {
  const widget = await findWidgetByIdForOwner(req.params.id, req.user!.id);
  if (!widget) return res.status(404).json({ error: "Widget not found" });
  res.json(widget);
});

// GET /api/widgets/:id/submissions — the owner's leads for one widget
widgetsRouter.get("/:id/submissions", async (req, res) => {
  // First confirm the widget is the caller's (404 if not theirs / doesn't exist).
  const widget = await findWidgetByIdForOwner(req.params.id, req.user!.id);
  if (!widget) return res.status(404).json({ error: "Widget not found" });

  const submissions = await findSubmissionsForOwnerWidget(req.params.id, req.user!.id);
  res.json(submissions);
});

// GET /api/widgets/:id/stats — basic analytics
widgetsRouter.get("/:id/stats", async (req, res) => {
  const widget = await findWidgetByIdForOwner(req.params.id, req.user!.id);
  if (!widget) return res.status(404).json({ error: "Widget not found" });

  const stats = await findStatsForOwnerWidget(req.params.id, req.user!.id);
  res.json(stats);
});

// PATCH /api/widgets/:id - Update specific widget if owned
widgetsRouter.patch("/:id", async (req, res) => {
  // 1. Validate body
  const parsed = updateWidgetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.format() });
  }

  // 2. Call DB layer passing req.user!.id
  const updatedWidget = await updateWidgetForOwner(
    req.params.id,
    req.user!.id,
    parsed.data
  );

  // 3. Map result to status code
  if (!updatedWidget) return res.status(404).json({ error: "Widget not found" });
  res.json(updatedWidget);
});

// DELETE /api/widgets/:id - Delete specific widget if owned
widgetsRouter.delete("/:id", async (req, res) => {
  const deleted = await deleteWidgetForOwner(req.params.id, req.user!.id);
  if (!deleted) return res.status(404).json({ error: "Widget not found" });
  res.status(204).send();
});