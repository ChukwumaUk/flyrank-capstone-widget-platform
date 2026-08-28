interface GeoResult {
  country: string | null;
  city: string | null;
}

// Look up one IP via a primary provider. Throws on any failure — the caller
// (enrichIp below) is responsible for catching and falling back.
async function lookupPrimary(ip: string): Promise<GeoResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000); // 2s max — never hang a submission

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Primary geo returned ${res.status}`);
    const body = await res.json();
    return { country: body.country_name ?? null, city: body.city ?? null };
  } finally {
    clearTimeout(timeout);
  }
}

// A second, independent provider — used only if the primary fails.
async function lookupSecondary(ip: string): Promise<GeoResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}`, { signal: controller.signal });
    if (!res.ok) throw new Error(`Secondary geo returned ${res.status}`);
    const body = await res.json();
    return { country: body.country ?? null, city: body.city ?? null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function enrichIp(ip: string | null): Promise<GeoResult> {
  const empty: GeoResult = { country: null, city: null };

  // No IP to look up (e.g. localhost) -> no geo, no problem.
  if (!ip || ip === "127.0.0.1" || ip === "::1") {
    return empty;
  }

  // Try primary; on ANY failure, fall back to secondary; if that fails too, give up gracefully.
  try {
    return await lookupPrimary(ip);
  } catch (primaryErr) {
    console.warn(`[geo] primary failed for ${ip}: ${(primaryErr as Error).message}; trying secondary`);
    try {
      return await lookupSecondary(ip);
    } catch (secondaryErr) {
      console.warn(`[geo] secondary also failed for ${ip}: ${(secondaryErr as Error).message}; storing without geo`);
      return empty;   // BOTH failed -> null geo, but we NEVER throw
    }
  }
}