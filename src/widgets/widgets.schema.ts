import { z } from "zod";

export const createWidgetSchema = z.object({
  type: z.enum(["signup", "cta", "popover"]),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  allowed_origins: z.array(z.string().url()).optional(),
});