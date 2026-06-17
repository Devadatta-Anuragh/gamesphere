import type { Brand } from './ids.js';

/**
 * Money is stored as an integer number of MINOR units (e.g. kobo for ₦).
 * Never use floating point for money — `0.1 + 0.2 !== 0.3`. All arithmetic
 * happens on integers; formatting to a major-unit string is a display concern.
 */
export type Money = Brand<number, 'Money'>;

export const money = (minorUnits: number): Money => {
  if (!Number.isInteger(minorUnits)) {
    throw new Error(`Money must be an integer (minor units), got ${minorUnits}`);
  }
  return minorUnits as Money;
};

export const ZERO: Money = money(0);

export const addMoney = (a: Money, b: Money): Money => money(a + b);
export const subMoney = (a: Money, b: Money): Money => money(a - b);
export const isPositive = (a: Money): boolean => a > 0;
export const gte = (a: Money, b: Money): boolean => a >= b;

/** Apply a basis-points rake (1 bps = 0.01%). Returns { rake, net }. */
export const applyRakeBps = (
  gross: Money,
  rakeBps: number,
): { rake: Money; net: Money } => {
  const rake = money(Math.floor((gross * rakeBps) / 10_000));
  return { rake, net: subMoney(gross, rake) };
};
