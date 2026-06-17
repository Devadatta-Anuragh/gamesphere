import { money, type Money } from '@gamesphere/shared';

/**
 * Supported cash-table entry fees (minor units / kobo): ₦100, ₦500, ₦1,000.
 * Each tier has its own queue. Kept as a fixed set so a client cannot invent an
 * arbitrary stake.
 */
export const ENTRY_FEE_TIERS: readonly Money[] = [
  money(10_000),
  money(50_000),
  money(100_000),
];

export const isSupportedTier = (fee: number): boolean =>
  (ENTRY_FEE_TIERS as readonly number[]).includes(fee);

export const SEATS_PER_MATCH = 2;
