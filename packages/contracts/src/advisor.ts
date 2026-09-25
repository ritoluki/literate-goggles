export const ADVISOR_PROVIDERS = ['rules', 'opencode-jev', 'mock'] as const;
export type AdvisorProvider = (typeof ADVISOR_PROVIDERS)[number];

export type AdvisorCriteria = {
  category?: string;
  maxPriceVnd?: number;
  colors?: string[];
  purpose?: string;
  query?: string;
};

export type CatalogCandidate = {
  id: string;
  handle: string;
  title: string;
  priceVnd: number;
  inStock: boolean;
  category: string;
  colors: string[];
  purposes: string[];
};

export type AdvisorResult = {
  provider: AdvisorProvider;
  status: 'ok' | 'fallback' | 'clarify';
  candidates: CatalogCandidate[];
  reasons: string[];
};

export function parseMaxPriceVnd(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('maxPriceVnd must be a non-negative integer in VND');
  }
  return value;
}
