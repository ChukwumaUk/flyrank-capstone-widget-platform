import { Router } from "express";
import { createSubmissionSchema } from "./submissions.schema";
import { createSubmission } from "./submissions.service";

export const submissionsRouter = Router();

submissionsRouter.post("/", async (req, res) => {
  // 1. Validate structure at the boundary.
  const parsed = createSubmissionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid submission", details: parsed.error.issues });
  }

  // 2. Capture the visitor's IP (used for enrichment + rate limiting later).
  const ip_address =
    req.ip ?? (req.headers["x-forwarded-for"] as string) ?? null;

  // 3. Delegate to the service.
  const result = await createSubmission({
    widget_id: parsed.data.widget_id,
    data: parsed.data.data,
    ip_address,
    honeypot: parsed.data._hp,          // pass the honeypot to the service
  });

  // 4. Map the result to a status code.
  if (!result.ok) {
    return res.status(404).json({ error: "Widget not found" });
  }

  // Spam: pretend success, reveal nothing. (Optionally log server-side.)
  if (result.spam) {
    console.log(`[spam] honeypot triggered for widget ${parsed.data.widget_id}`);
    return res.status(201).json({ id: null, created_at: new Date().toISOString() });
  }

  res.status(201).json({ id: result.submission!.id, created_at: result.submission!.created_at });
});