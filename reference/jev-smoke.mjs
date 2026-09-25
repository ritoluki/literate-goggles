import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const ENDPOINT = "https://opencode.ai/zen/v1/systemone";
export const FREE_MODEL = "jev-1.13-free";
export const MAX_REQUEST_BYTES = 16 * 1024;
export const MAX_RESPONSE_BYTES = 64 * 1024;
const requestUrl = new URL("../contracts/jev.request.example.json", import.meta.url);
const fixtureUrl = new URL("../contracts/jev.response.synthetic.json", import.meta.url);

export class SafeError extends Error {
  constructor(code) { super(code); this.name = "SafeError"; this.code = code; }
}
function check(condition, code) { if (!condition) throw new SafeError(code); }
const plain = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const unit = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
function sameKeys(left, right) {
  const a = Object.keys(left).sort();
  const b = Object.keys(right).sort();
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

export function validateRequest(request) {
  check(plain(request), "INVALID_REQUEST");
  check(request.model === FREE_MODEL, "NON_FREE_MODEL_BLOCKED");
  check(typeof request.state === "string" && request.state.length > 0, "INVALID_STATE");
  check(plain(request.questions) && Object.keys(request.questions).length > 0, "INVALID_QUESTIONS");
  for (const question of Object.values(request.questions)) {
    check(plain(question) && question.type === "choice", "INVALID_QUESTION_TYPE");
    check(typeof question.instructions === "string" && question.instructions.length > 0, "INVALID_INSTRUCTIONS");
    check(plain(question.criteria) && Object.keys(question.criteria).length >= 2, "INVALID_CRITERIA");
    check(Object.keys(question.criteria).length <= 13, "TOO_MANY_CRITERIA");
  }
  check(Buffer.byteLength(JSON.stringify(request), "utf8") <= MAX_REQUEST_BYTES, "REQUEST_TOO_LARGE");
  return request;
}

export function validateResponse(response, request) {
  validateRequest(request);
  check(plain(response), "INVALID_RESPONSE");
  check(typeof response.model === "string" && response.model.length > 0 && response.model.length <= 200, "INVALID_MODEL");
  check(plain(response.answers) && sameKeys(response.answers, request.questions), "INVALID_ANSWER_KEYS");
  const summaries = {};
  for (const [id, question] of Object.entries(request.questions)) {
    const answer = response.answers[id];
    check(plain(answer) && answer.type === "choice", "INVALID_ANSWER_TYPE");
    check(typeof answer.choice === "string" && own(question.criteria, answer.choice), "INVALID_CHOICE");
    check(plain(answer.probabilities) && sameKeys(answer.probabilities, question.criteria), "INVALID_PROBABILITY_KEYS");
    const values = Object.values(answer.probabilities);
    check(values.every(unit), "INVALID_PROBABILITY");
    check(Math.abs(values.reduce((sum, value) => sum + value, 0) - 1) <= 0.02 + 1e-12, "INVALID_PROBABILITY_SUM");
    check(unit(answer.confidence), "INVALID_CONFIDENCE");
    const ranked = [...values].sort((a, b) => b - a);
    const topProbability = answer.probabilities[answer.choice];
    check(topProbability >= ranked[0] - 1e-6, "CHOICE_NOT_TOP");
    summaries[id] = {
      choice: answer.choice,
      topProbability,
      margin: ranked[0] - (ranked[1] ?? 0),
      confidence: answer.confidence
    };
  }
  // This reference request deliberately contains only primary_candidate.
  const primary = summaries.primary_candidate;
  check(primary && primary.choice !== "NONE", "NO_SUITABLE_CANDIDATE");
  check(primary.topProbability >= 0.60 && primary.margin >= 0.15, "LOW_CONFIDENCE");
  return summaries;
}

export async function readBoundedJson(response, maxBytes = MAX_RESPONSE_BYTES) {
  check(response.ok, `HTTP_${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  check(type.toLowerCase().includes("application/json"), "NON_JSON_RESPONSE");
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    const size = Number(declared);
    check(Number.isFinite(size) && size >= 0 && size <= maxBytes, "RESPONSE_TOO_LARGE");
  }
  check(response.body !== null, "EMPTY_RESPONSE");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new SafeError("RESPONSE_TOO_LARGE");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new SafeError("INVALID_JSON");
  }
}

export async function execute({
  live = false,
  env = process.env,
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000
} = {}) {
  const request = validateRequest(JSON.parse(await readFile(requestUrl, "utf8")));
  if (!live) {
    const response = JSON.parse(await readFile(fixtureUrl, "utf8"));
    return {
      mode: "synthetic-fixture",
      liveVerified: false,
      networkCalls: 0,
      answers: validateResponse(response, request)
    };
  }
  check(env.ALLOW_LIVE_JEV_TEST === "1", "LIVE_NOT_APPROVED");
  check(typeof env.OPENCODE_API_KEY === "string" && env.OPENCODE_API_KEY.trim().length >= 8, "MISSING_API_KEY");
  check(!/[\r\n]/u.test(env.OPENCODE_API_KEY), "INVALID_API_KEY");
  check(Number.isSafeInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 5000, "INVALID_TIMEOUT");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENCODE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(request),
      redirect: "error",
      signal: controller.signal
    });
    const parsed = await readBoundedJson(response);
    return {
      mode: "live",
      liveVerified: true,
      networkCalls: 1,
      requestedModel: FREE_MODEL,
      elapsedMs: Date.now() - startedAt,
      answers: validateResponse(parsed, request)
    };
  } catch (error) {
    if (error instanceof SafeError) throw error;
    throw new SafeError(controller.signal.aborted ? "TIMEOUT" : "NETWORK_FAILURE");
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const flags = process.argv.slice(2);
  check(flags.length <= 1 && flags.every((flag) => flag === "--live" || flag === "--fixture"), "INVALID_ARGUMENTS");
  const result = await execute({ live: flags.includes("--live") });
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const code = error instanceof SafeError ? error.code : "LOCAL_REFERENCE_FAILURE";
    console.error(JSON.stringify({ ok: false, code }));
    process.exitCode = 1;
  });
}
