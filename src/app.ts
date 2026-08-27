import express from "express";
import { widgetsRouter } from "./widgets/widgets.routes";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/widgets", widgetsRouter);