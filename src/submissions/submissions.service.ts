import { findWidgetForSubmission, insertSubmission } from "./submissions.repository";

interface CreateSubmissionInput {
  widget_id: string;
  data: Record<string, unknown>;
  ip_address: string | null;
  honeypot?: string;                   // the _hp value, if any
}

export async function createSubmission(input: CreateSubmissionInput) {

  // Spam check FIRST: a filled honeypot = a bot. Drop silently.
  if (input.honeypot && input.honeypot.trim() !== "") {
    return { ok: true as const, spam: true as const, submission: null };
  }

  // The widget must exist (public existence check, not an ownership check).
  const widget = await findWidgetForSubmission(input.widget_id);
  if (!widget) {
    return { ok: false as const, reason: "widget_not_found" as const };
  }

  // Store the submission. Geo enrichment comes later — nulls for now.
  const submission = await insertSubmission({
    widget_id: input.widget_id,
    data: input.data,
    ip_address: input.ip_address,
    country: null,
    city: null,
  });

  return { ok: true as const, spam: false as const, submission };
}