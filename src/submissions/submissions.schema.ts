import { z } from "zod";

export const createSubmissionSchema = z.object({
  widget_id: z.uuid(),                          // which widget this submission is for
  data: z.record(z.string(), z.unknown()),      // the form field values (shape varies by widget)
  _hp: z.string().optional(),          // honeypot — should always be empty/absent
  
});