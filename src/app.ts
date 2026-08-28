import express from "express";
import { widgetsRouter } from "./widgets/widgets.routes";
import { authRouter } from "./auth/auth.routes";
import { requireAuth } from "./middleware/requireAuth";
import { submissionsRouter } from "./submissions/submissions.routes";
import { submissionCors } from "./submissions/cors";

export const app = express();

// Submission path: strict body size cap (a lead-capture form is tiny).
const submissionJson = express.json({ limit: "10kb" });

app.use(express.json());
app.use("/submissions", submissionCors, submissionJson, submissionsRouter);

app.options("/submissions", submissionCors);          // handle preflight
app.post("/submissions", submissionCors, (_req, res) => {
  res.status(201).json({ message: "submission received (stub)" });
});



app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);  // public: signup / login

app.use("/api/widgets", requireAuth, widgetsRouter);  // protected: auth runs first