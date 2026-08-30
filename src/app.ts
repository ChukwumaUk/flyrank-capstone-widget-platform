import express from "express";
import { widgetsRouter } from "./widgets/widgets.routes";
import { authRouter } from "./auth/auth.routes";
import { requireAuth } from "./middleware/requireAuth";
import { submissionsRouter } from "./submissions/submissions.routes";
import { submissionCors } from "./submissions/cors";
import { submissionRateLimit } from "./submissions/rateLimit";
import { configRouter } from "./widgets/config.routes";
import cors from "cors";

export const app = express();

// Submission path: strict body size cap (a lead-capture form is tiny).
const submissionJson = express.json({ limit: "10kb" });

app.use(express.json());

app.use(
  "/submissions",
  submissionCors,          // 1. CORS: is this origin allowed?
  submissionRateLimit,     // 2. Rate limit: is this IP flooding?
  submissionJson,          // 3. Parse + size-limit the body (<=10kb)
  submissionsRouter        // 4. Validate structure, check widget, store
);

app.options("/submissions", submissionCors);          // handle preflight
app.post("/submissions", submissionCors, (_req, res) => {
  res.status(201).json({ message: "submission received (stub)" });
});



app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);  // public: signup / login

app.use("/api/widgets", requireAuth, widgetsRouter);  // protected: auth runs first

// Public config: readable cross-origin (the widget script fetches it from any site).
app.use("/widgets", cors(), configRouter);