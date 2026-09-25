/** Project BFF contracts. These are not Medusa's external DTOs. */
import type { CategoryKey, ColorKey, Preferences, ReasonCode } from "./decision-provider.types";

export interface ApiSuccess<T> { data: T; requestId: string; }
export interface ApiError {
  error: {
    code: string; message: string; retryable: boolean;
    fieldErrors?: Record<string, string[]>;
  };
  requestId: string;
}
export interface ProductCard {
  id: string; handle: string; title: string; thumbnail: string | null;
  categoryKey: CategoryKey;
  priceRangeVnd: { min: number; max: number };
  inStock: boolean; availableColors: ColorKey[]; demo: boolean;
}
export interface ProductDetail extends ProductCard {
  description: string;
  images: { url: string; alt: string }[];
  variants: {
    id: string; sku: string; options: { color: ColorKey };
    priceVnd: number | null; available: boolean; maxOrderQuantity: number;
  }[];
  attributes: Record<string, string | number | string[]>;
}
export interface CartLine {
  lineId: string; productId: string; variantId: string; title: string;
  variantLabel: string; unitPriceVnd: number; quantity: number;
  totalVnd: number; available: boolean;
}
export interface CartSnapshot {
  revision: string; currency: "vnd"; items: CartLine[];
  subtotalVnd: number; discountVnd: number; shippingVnd: number | null;
  taxVnd: number; totalVnd: number; canCheckout: boolean; warnings: string[];
}
export interface CheckoutAddress {
  fullName: string; phone: string; addressLine1: string;
  addressLine2?: string; ward?: string; city: string;
  postalCode?: string; countryCode: "vn";
}
export interface CheckoutReview {
  reviewToken: string; expiresAt: string; cart: CartSnapshot;
}
export type CompletionResult =
  | { status: "succeeded"; orderReference: string; confirmationPath: string }
  | { status: "pending"; intentId: string; pollAfterMs: number }
  | { status: "failed"; code: string; retryable: boolean };

export interface AdvisorRequest {
  preferences: Preferences; message?: string; clientTurnId: string;
}
export interface Recommendation {
  productId: string; variantId: string; handle: string; title: string;
  color: ColorKey; priceVnd: number; thumbnail: string | null;
  reasonCodes: ReasonCode[]; reasons: string[];
}
export interface AdvisorResponse {
  status: "results" | "clarify" | "no_match";
  mode: "rules" | "jev" | "fallback";
  normalizedPreferences: Preferences;
  recommendations: Recommendation[];
  clarification: {
    field: string; question: string; choices: { value: string; label: string }[];
  } | null;
  notice: string | null;
  requestId: string;
}
/** No raw model body, confidence, token or internal session ID in public response. */
