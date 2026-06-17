/**
 * Branded id types. They are structurally `string` at runtime but distinct at
 * compile time, so a `UserId` can never be passed where a `MatchId` is expected.
 * This is cheap type-safety that prevents a whole class of mix-up bugs.
 */
declare const brand: unique symbol;

export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'UserId'>;
export type MatchId = Brand<string, 'MatchId'>;
export type RoomId = Brand<string, 'RoomId'>;
export type TransactionId = Brand<string, 'TransactionId'>;
export type LedgerEntryId = Brand<string, 'LedgerEntryId'>;

export const asUserId = (value: string): UserId => value as UserId;
export const asMatchId = (value: string): MatchId => value as MatchId;
export const asRoomId = (value: string): RoomId => value as RoomId;
export const asTransactionId = (value: string): TransactionId =>
  value as TransactionId;
