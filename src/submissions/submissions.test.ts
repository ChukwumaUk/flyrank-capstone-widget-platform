import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { beforeEach } from "vitest";
import { insertSubmission } from "./submissions.repository";
import { submissionRateLimitStore } from "./rateLimit";


beforeEach(() => {
  vi.clearAllMocks();
  submissionRateLimitStore.resetAll?.();   // clear rate-limit counts between tests

});

// Two structurally-valid UUIDs the mock and tests share.
const EXISTING_WIDGET = "11111111-1111-4111-8111-111111111111";
const MISSING_WIDGET  = "22222222-2222-4222-8222-222222222222";

vi.mock("./geo", () => ({
  enrichIp: vi.fn(async () => ({ country: null, city: null })),
}));

vi.mock("./submissions.repository", () => ({
  findWidgetForSubmission: vi.fn(async (id: string) =>
    id === EXISTING_WIDGET ? { id, owner_id: "owner-abc" } : null
  ),
  insertSubmission: vi.fn(async () => ({ id: "1", created_at: new Date().toISOString() })),
}));

import { app } from "../app";

describe("POST /submissions — validation", () => {
  it("rejects a malformed widget_id with 400", async () => {
    const res = await request(app).post("/submissions").send({ widget_id: "not-a-uuid", data: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid submission");
  });

  it("rejects a missing data field with 400", async () => {
    const res = await request(app).post("/submissions").send({ widget_id: EXISTING_WIDGET });
    expect(res.status).toBe(400);
  });

  it("stores a valid submission and returns 201", async () => {
    const res = await request(app)
      .post("/submissions")
      .send({ widget_id: EXISTING_WIDGET, data: { email: "test@example.com" } });
    expect(res.status).toBe(201);
  });

  it("returns 404 for a submission to a non-existent widget", async () => {
    const res = await request(app)
      .post("/submissions")
      .send({ widget_id: MISSING_WIDGET, data: { email: "test@example.com" } });
    expect(res.status).toBe(404);
  });
});

describe("POST /submissions — spam honeypot", () => {
  it("silently drops a submission with the honeypot filled (stores nothing)", async () => {
    const res = await request(app)
      .post("/submissions")
      .send({
        widget_id: EXISTING_WIDGET,
        data: { email: "bot@example.com" },
        _hp: "http://spam.com",   // a bot filled the trap
      });

    // Looks like success to the bot...
    expect(res.status).toBe(201);
    // ...but NOTHING was stored — insertSubmission must NOT have been called.
    expect(insertSubmission).not.toHaveBeenCalled();
  });
});

describe("POST /submissions — rate limiting", () => {
  it("returns 429 after the limit is exceeded", async () => {
    const body = { widget_id: EXISTING_WIDGET, data: { email: "flood@example.com" } };
    let sawRateLimit = false;

    // Fire more than the limit (20) — some should come back 429.
    for (let i = 0; i < 25; i++) {
      const res = await request(app).post("/submissions").send(body);
      if (res.status === 429) sawRateLimit = true;
    }

    expect(sawRateLimit).toBe(true);
  });
});

describe("POST /submissions — geo enrichment degrades", () => {
  it("still stores the submission (201) when enrichment returns null geo", async () => {
    // Our geo mock already returns { country: null, city: null } — simulating total failure.
    const res = await request(app)
      .post("/submissions")
      .send({ widget_id: EXISTING_WIDGET, data: { email: "nogeo@example.com" } });

    expect(res.status).toBe(201);   // submission succeeds despite no geo
  });
});