/**
 * Accounts in the double-entry system. Every money movement is a transfer
 * BETWEEN accounts, so the sum of all account balances is invariant at 0 —
 * money is conserved, never created or destroyed inside the system.
 *
 *  - USER     : a player's spendable balance (cannot go negative)
 *  - ESCROW   : per-match pool holding staked entry fees (cannot go negative)
 *  - HOUSE    : accumulates rake (may be any sign)
 *  - EXTERNAL : the outside world; deposits/bonuses flow in from here, so it
 *               trends negative by the total value injected (may go negative)
 */
export enum AccountType {
  User = 'USER',
  Escrow = 'ESCROW',
  House = 'HOUSE',
  External = 'EXTERNAL',
}

export interface AccountRef {
  readonly type: AccountType;
  readonly ref: string;
}

/** Stable string key used as the balance document id and for indexing. */
export const accountKey = (a: AccountRef): string => `${a.type}:${a.ref}`;

export const userAccount = (userId: string): AccountRef => ({
  type: AccountType.User,
  ref: userId,
});

export const escrowAccount = (matchId: string): AccountRef => ({
  type: AccountType.Escrow,
  ref: matchId,
});

export const HOUSE_ACCOUNT: AccountRef = { type: AccountType.House, ref: 'house' };
export const EXTERNAL_ACCOUNT: AccountRef = {
  type: AccountType.External,
  ref: 'external',
};

/** Accounts whose balance must never be allowed to go negative. */
export const isGuarded = (type: AccountType): boolean =>
  type === AccountType.User || type === AccountType.Escrow;
