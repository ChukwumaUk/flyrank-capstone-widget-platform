import { Router } from "express";
import { supabase } from "../supabaseClient";

export const authRouter = Router();

authRouter.post("/signup", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ user: data.user });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return res.status(401).json({ error: "Invalid login credentials" });
  }
  res.status(200).json({ access_token: data.session.access_token });
});