import { findWidgetForSubmission, insertSubmission } from "./submissions.repository";
import { enrichIp } from "./geo";
import { notifyOwner } from "./notify";

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

  // Enrich with geo — this NEVER throws, worst case returns null geo.
  const geo = await enrichIp(input.ip_address);

  // Store the submission. Geo enrichment comes later — nulls for now.
  const submission = await insertSubmission({
    widget_id: input.widget_id,
    data: input.data,
    ip_address: input.ip_address,
    country: geo.country,    // real value, or null if enrichment degraded
    city: geo.city,
  });

  // Side effect: notify the owner. This MUST NOT break the submission.
  try {
    await notifyOwner(widget.owner_id, submission.id);
  } catch (err) {
    console.error(`[notify] failed for submission ${submission.id}: ${(err as Error).message}`);
    // Swallow it: the lead is already saved. Notification is best-effort.
  }

  return { ok: true as const, spam: false as const, submission };
}