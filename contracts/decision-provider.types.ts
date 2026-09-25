/** Internal design contract, not an external SDK. Runtime validation is mandatory. */
export type CategoryKey = "desk-mat" | "laptop-stand" | "cable-organizer" | "stationery";
export type ColorKey = "black" | "gray" | "beige" | "green" | "white" | "brown";
export type UseCase = "small-desk" | "portable" | "organize" | "gift" | "comfort" | "writing";
export type StyleKey = "minimal" | "natural" | "colorful";
export type SpaceFit = "small" | "medium" | "large";
export type ClarifyField = "categoryKey" | "useCase" | "style";
export type ReasonCode =
  | "WITHIN_BUDGET" | "MATCHES_USE_CASE" | "SMALL_DESK" | "PORTABLE"
  | "MATCHES_STYLE" | "IN_STOCK" | "LOWEST_PRICE";

export interface Preferences {
  categoryKey?: CategoryKey;
  minPriceVnd?: number;
  maxPriceVnd?: number; // Inclusive integer VND; strict textual bounds are normalized first.
  color?: ColorKey;
  useCase?: UseCase;
  style?: StyleKey;
  spaceFit?: SpaceFit;
  budgetScope?: "per-item";
  sortPreference?: "relevance" | "lowest-price";
}
export interface Candidate {
  candidateId: string; // Validated c01..c12; not an actual product ID.
  productId: string;
  variantId: string;
  handle: string;
  categoryKey: CategoryKey;
  color: ColorKey;
  priceVnd: number;
  currency: "vnd";
  available: true;
  useCases: readonly UseCase[];
  styles: readonly StyleKey[];
  spaceFit: readonly SpaceFit[];
}
/** Pass only allowed normalized attributes upstream, never Candidate verbatim. */
export interface ProviderSafeCandidate {
  id: string;
  categoryKey: CategoryKey;
  color: ColorKey;
  priceVnd: number;
  currency: "vnd";
  useCases: readonly UseCase[];
  styles: readonly StyleKey[];
  spaceFit: readonly SpaceFit[];
}
export interface DecisionInput {
  preferences: Readonly<Preferences>;
  candidates: readonly Candidate[];
  missingFields: readonly ClarifyField[];
  clarificationCount: 0 | 1 | 2;
}
export interface DecisionSuccess {
  ok: true;
  source: "rules" | "jev";
  decision:
    | { action: "SHOW_RECOMMENDATIONS"; primaryCandidateId: string }
    | { action: "ASK_CLARIFY"; field: ClarifyField };
  diagnostics?: { topProbability: number; margin: number; confidence: number };
}
export type UnavailableReason =
  | "DISABLED" | "NOT_APPROVED" | "QUOTA" | "QUOTA_BACKEND_UNAVAILABLE"
  | "CIRCUIT_OPEN" | "AUTH" | "MODEL_UNAVAILABLE" | "TIMEOUT"
  | "UPSTREAM_RATE_LIMIT" | "UPSTREAM_OVERLOADED" | "UPSTREAM_FAILURE"
  | "INVALID_RESPONSE" | "INCONSISTENT_RESPONSE" | "LOW_CONFIDENCE";
export interface DecisionUnavailable { ok: false; reason: UnavailableReason; }
export interface DecisionProvider {
  decide(input: Readonly<DecisionInput>, signal: AbortSignal):
    Promise<DecisionSuccess | DecisionUnavailable>;
}
export interface ChoiceQuestion {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
}
export interface JevRequest {
  model: "jev-1.13-free";
  state: string;
  questions: Record<string, ChoiceQuestion>;
}
export interface ChoiceAnswer {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
}
export interface JevResponse {
  model: string;
  answers: Record<string, ChoiceAnswer>;
  usage?: { input_tokens: number; output_tokens: number };
}
