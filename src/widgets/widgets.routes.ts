import { Router } from "express";
import { createWidgetSchema } from "./widgets.schema";
import { createWidget } from "./widgets.service";

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