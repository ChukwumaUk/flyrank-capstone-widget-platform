import { Request, Response, NextFunction } from "express";
import { supabase } from "../supabaseClient";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.header("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Access token required" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Attach the verified user — now type-safe thanks to express.d.ts.
  req.user = { id: data.user.id, email: data.user.email };
  next();
}