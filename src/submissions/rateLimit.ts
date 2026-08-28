import rateLimit from "express-rate-limit";

export const submissionRateLimit = rateLimit({
  windowMs: 60 * 1000,          // 1 minute window
  limit: 20,                    // max 20 requests per IP per window, generous for a human filling a form, tight enough to stop a flood
  standardHeaders: "draft-7",   // send RateLimit-* headers so clients can self-throttle
  legacyHeaders: false,         // don't send the old X-RateLimit-* headers
  message: { error: "Too many submissions, please try again later." },
  // keyGenerator defaults to the client IP — exactly what we want (per-IP).
});