import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ENDPOINT, FREE_MODEL, MAX_RESPONSE_BYTES, execute, validateRequest, validateResponse, readBoundedJson
} from "./jev-smoke.mjs";

const request = JSON.parse(await readFile(new URL("../contracts/jev.request.example.json", import.meta.url), "utf8"));
const fixture = JSON.parse(await readFile(new URL("../contracts/jev.response.synthetic.json", import.meta.url), "utf8"));
const clone = (x) => structuredClone(x);
const jsonResponse = (x) => new Response(JSON.stringify(x), { headers: { "content-type": "application/json" } });
const approved = { ALLOW_LIVE_JEV_TEST: "1", OPENCODE_API_KEY: "synthetic-test-key-not-real" };

test("valid synthetic fixture is accepted", () => {
  assert.equal(validateResponse(fixture, request).primary_candidate.choice, "c01");
});
test("offline mode performs no network calls", async () => {
  const result = await execute({ fetchImpl: () => { throw new Error("network must not run"); } });
  assert.equal(result.mode, "synthetic-fixture");
  assert.equal(result.liveVerified, false);
  assert.equal(result.networkCalls, 0);
});
test("a paid model request is blocked", () => {
  const req = clone(request); req.model = "jev-1.13";
  assert.throws(() => validateRequest(req), /NON_FREE_MODEL_BLOCKED/u);
});
test("extra answer keys rejected", () => {
  const res = clone(fixture); res.answers.extra = res.answers.primary_candidate;
  assert.throws(() => validateResponse(res, request), /INVALID_ANSWER_KEYS/u);
});
test("unknown candidate rejected", () => {
  const res = clone(fixture); res.answers.primary_candidate.choice = "c99";
  assert.throws(() => validateResponse(res, request), /INVALID_CHOICE/u);
});
test("missing probability option rejected", () => {
  const res = clone(fixture); delete res.answers.primary_candidate.probabilities.NONE;
  assert.throws(() => validateResponse(res, request), /INVALID_PROBABILITY_KEYS/u);
});
for (const bad of [-0.1, 1.1, NaN, Infinity, "0.85"]) {
  test(`invalid probability ${String(bad)} rejected`, () => {
    const res = clone(fixture); res.answers.primary_candidate.probabilities.c01 = bad;
    assert.throws(() => validateResponse(res, request), /INVALID_PROBABILITY/u);
  });
}
test("incorrect sum rejected", () => {
  const res = clone(fixture); res.answers.primary_candidate.probabilities.c01 = 0.65;
  assert.throws(() => validateResponse(res, request), /INVALID_PROBABILITY_SUM/u);
});
test("choice must be highest probability", () => {
  const res = clone(fixture); res.answers.primary_candidate.choice = "c02";
  assert.throws(() => validateResponse(res, request), /CHOICE_NOT_TOP/u);
});
test("invalid confidence rejected", () => {
  const res = clone(fixture); res.answers.primary_candidate.confidence = null;
  assert.throws(() => validateResponse(res, request), /INVALID_CONFIDENCE/u);
});
test("low-confidence response rejected", () => {
  const res = clone(fixture);
  res.answers.primary_candidate.probabilities = { c01: 0.5, c02: 0.45, NONE: 0.05 };
  assert.throws(() => validateResponse(res, request), /LOW_CONFIDENCE/u);
});
test("NONE is not a usable primary recommendation", () => {
  const res = clone(fixture); res.answers.primary_candidate.choice = "NONE";
  res.answers.primary_candidate.probabilities = { c01: 0.1, c02: 0.05, NONE: 0.85 };
  assert.throws(() => validateResponse(res, request), /NO_SUITABLE_CANDIDATE/u);
});
test("live requires explicit approval even with key", async () => {
  await assert.rejects(execute({ live: true, env: { OPENCODE_API_KEY: approved.OPENCODE_API_KEY } }), /LIVE_NOT_APPROVED/u);
});
test("live requires API key", async () => {
  await assert.rejects(execute({ live: true, env: { ALLOW_LIVE_JEV_TEST: "1" } }), /MISSING_API_KEY/u);
});
test("mock transport proves endpoint/model/no retry, not actual API availability", async () => {
  let calls = 0;
  const result = await execute({
    live: true, env: approved,
    fetchImpl: async (url, options) => {
      calls++;
      assert.equal(url, ENDPOINT);
      assert.equal(options.redirect, "error");
      assert.equal(JSON.parse(options.body).model, FREE_MODEL);
      return jsonResponse(fixture);
    }
  });
  assert.equal(calls, 1);
  assert.equal(result.answers.primary_candidate.choice, "c01");
  assert.ok(!JSON.stringify(result).includes(approved.OPENCODE_API_KEY));
});
test("HTTP429 is surfaced without a retry or paid fallback", async () => {
  let calls = 0;
  await assert.rejects(execute({
    live: true, env: approved,
    fetchImpl: async () => { calls++; return new Response("do not log body", { status: 429 }); }
  }), /HTTP_429/u);
  assert.equal(calls, 1);
});
test("HTML200 is rejected", async () => {
  await assert.rejects(readBoundedJson(new Response("<html>quota</html>", {
    headers: { "content-type": "text/html" }
  })), /NON_JSON_RESPONSE/u);
});
test("malformed JSON rejected", async () => {
  await assert.rejects(readBoundedJson(new Response("{oops", {
    headers: { "content-type": "application/json" }
  })), /INVALID_JSON/u);
});
test("oversized streaming body rejected without trusting content-length", async () => {
  await assert.rejects(readBoundedJson(new Response("x".repeat(MAX_RESPONSE_BYTES + 1), {
    headers: { "content-type": "application/json" }
  })), /RESPONSE_TOO_LARGE/u);
});
test("oversized declared body rejected", async () => {
  await assert.rejects(readBoundedJson(new Response("{}", {
    headers: { "content-type": "application/json", "content-length": String(MAX_RESPONSE_BYTES + 1) }
  })), /RESPONSE_TOO_LARGE/u);
});
test("network failure sanitized", async () => {
  await assert.rejects(execute({
    live: true, env: approved,
    fetchImpl: async () => { throw new Error("sensitive upstream details"); }
  }), (error) => error.message === "NETWORK_FAILURE");
});
test("timeout abort is sanitized and not retried", async () => {
  await assert.rejects(execute({
    live: true, env: approved, timeoutMs: 5,
    fetchImpl: (_, options) => new Promise((_, reject) => {
      options.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    })
  }), /TIMEOUT/u);
});
test("request fixture has no raw message or persistent identifiers", () => {
  const state = JSON.parse(request.state);
  for (const field of ["message", "email", "phone", "sessionToken", "cartId", "orderId", "ip"]) {
    assert.ok(!Object.hasOwn(state, field));
  }
  assert.ok(state.candidates.every((x) => /^c\d{2}$/u.test(x.id)));
});
