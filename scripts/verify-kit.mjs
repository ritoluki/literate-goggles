/** Offline documentation/fixture checks only. NOT an application acceptance test. */
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const root = new URL("../", import.meta.url);
const text = (path) => readFile(new URL(path, root), "utf8");
const json = async (path) => JSON.parse(await text(path));
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }

const required = [
  "README.md", "AGENTS.md", "START_HERE.md",
  "state/PROGRESS.md", "state/DECISIONS.md", "state/TASKS.md",
  "state/BLOCKERS.md", "state/VERIFICATION.md", "state/VERSIONS.md",
  "state/ENVIRONMENT.md", "state/MEDUSA-API-MAP.md", "state/LAUNCH-APPROVALS.md",
  "prompts/START-CODEX.txt", "prompts/CONTINUE-CODEX.txt", "prompts/RELEASE-CODEX.txt",
  "contracts/bff.types.ts", "contracts/decision-provider.types.ts",
  "ops/env.storefront.example", "ops/env.backend.example", "ops/env.infra.example",
  "reference/jev-smoke.mjs", "reference/jev-smoke.test.mjs"
];
for (const path of required) {
  check((await text(path)).length > 0, `Missing or empty: ${path}`);
}
check(Buffer.byteLength(await text("AGENTS.md"), "utf8") < 32768, "AGENTS too large");
const reqDoc = await text("docs/01-requirements.md");
const testDoc = await text("docs/08-test-plan.md");
const taskDoc = await text("state/TASKS.md");
for (let i = 1; i <= 20; i++) check(reqDoc.includes(`FR-${String(i).padStart(2, "0")}`), `Missing FR ${i}`);
for (let i = 1; i <= 60; i++) check(testDoc.includes(`AT-${String(i).padStart(2, "0")}`), `Missing AT ${i}`);
for (let i = 1; i <= 51; i++) check(taskDoc.includes(`T${String(i).padStart(3, "0")}`), `Missing task ${i}`);
const data = await json("fixtures/catalog.seed.json");
check(data.kind === "synthetic-demo-fixture" && data.notForLiveImport === true, "Fixture must stay synthetic");
check(data.products.length === 24, "Expected 24 seed products");
check(new Set(data.products.map((p) => p.handle)).size === 24, "Duplicate handle");
const variants = data.products.flatMap((product) => product.variants);
check(variants.length === 48, "Expected 48 variants");
check(new Set(variants.map((v) => v.sku)).size === 48, "Duplicate SKU");
const keys = new Set(variants.map((v) => v.seedKey));
check(keys.size === 48, "Duplicate variant seed key");
for (const v of variants) {
  check(v.priceVnd === null || (Number.isSafeInteger(v.priceVnd) && v.priceVnd >= 0), `Bad price ${v.seedKey}`);
  check(Number.isSafeInteger(v.inventoryQuantity) && v.inventoryQuantity >= 0, `Bad inventory ${v.seedKey}`);
}
const cases = (await text("fixtures/ai.eval-cases.jsonl")).trim().split("\n").map((line) => JSON.parse(line));
check(cases.length >= 60, "Need at least 60 evaluation seeds");
check(cases.filter((c) => c.split === "holdout").length >= 20, "Need at least 20 holdout cases");
check(new Set(cases.map((c) => c.id)).size === cases.length, "Duplicate case ID");
for (const c of cases) {
  check(Boolean(c.expected && c.input), `Missing input/expectation ${c.id}`);
  for (const key of c.expected.allowedVariantSeedKeys ?? []) check(keys.has(key), `Unknown expected variant ${key}`);
}
const providerRequest = await json("contracts/jev.request.example.json");
check(providerRequest.model === "jev-1.13-free", "Only free model allowed");
const providerState = JSON.parse(providerRequest.state);
check(providerState.candidates.length <= 12, "Too many candidates");
const routes = await json("contracts/bff.routes.json");
check(routes.implementationStatus === "NOT_IMPLEMENTED", "Source contract label was changed; review implementation separately");
check(new Set(routes.routes.map((r) => `${r.method} ${r.path}`)).size === routes.routes.length, "Duplicate route");
await json("contracts/jev.response.synthetic.json");
await json("contracts/bff.request-schemas.json");
const release = await json("ops/release-manifest.example.json");
check(release.checkoutLiveApproved === false, "Example must not grant live approval");
check(release.ai.paidFallback === false, "Paid fallback not allowed");
console.log(JSON.stringify({
  ok: true, scope: "documentation-and-synthetic-fixtures-only",
  checks, products: 24, variants: 48, evalCases: cases.length,
  applicationTestsRun: false, liveApiCalls: 0
}, null, 2));
