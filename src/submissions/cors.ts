import cors from "cors";
import { CorsOptions } from "cors";

// A permissive policy for now — we'll tighten it to per-widget allowed_origins
// once the submission endpoint knows which widget is being submitted to.
const corsOptions: CorsOptions = {
  origin: true,                 // reflect the request's origin (allow any, for now)
  methods: ["POST", "OPTIONS"], // the submission path only needs these
  allowedHeaders: ["Content-Type"],
  maxAge: 86400,                // browsers may cache the preflight answer for 24h
};

export const submissionCors = cors(corsOptions);