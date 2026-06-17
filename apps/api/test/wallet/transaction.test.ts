import { describe, expect, it } from 'vitest';
import { money } from '@gamesphere/shared';
import {
  Movements,
  isBalanced,
  netDeltas,
} from '@/modules/wallet/domain/transaction.js';
import {
  AccountType,
  accountKey,
  escrowAccount,
  userAccount,
} from '@/modules/wallet/domain/account.js';
import { EntryReason } from '@/modules/wallet/domain/ledger.js';

describe('wallet domain — movement builders', () => {
  it('external credit is balanced (user up, external down)', () => {
    const entries = Movements.externalCredit('alice', money(500), EntryReason.Deposit);
    expect(isBalanced(entries)).toBe(true);
    const deltas = netDeltas(entries);
    expect(deltas.get(accountKey(userAccount('alice')))?.delta).toBe(500);
  });

  it('stake moves money from user to match escrow', () => {
    const entries = Movements.stake('alice', 'm1', money(100));
    expect(isBalanced(entries)).toBe(true);
    const deltas = netDeltas(entries);
    expect(deltas.get(accountKey(userAccount('alice')))?.delta).toBe(-100);
    expect(deltas.get(accountKey(escrowAccount('m1')))?.delta).toBe(100);
  });

  it('settlement splits the pool into winnings + rake and stays balanced', () => {
    // pool of 200 with 10% rake -> winner 180, house 20
    const { entries, winnings, rake } = Movements.settlement(
      'alice',
      'm1',
      money(200),
      1000,
    );
    expect(winnings).toBe(180);
    expect(rake).toBe(20);
    expect(isBalanced(entries)).toBe(true);

    const deltas = netDeltas(entries);
    expect(deltas.get(accountKey(escrowAccount('m1')))?.delta).toBe(-200);
    expect(deltas.get(accountKey(userAccount('alice')))?.delta).toBe(180);
    expect(deltas.get(`${AccountType.House}:house`)?.delta).toBe(20);
  });

  it('rake rounds down (house never over-collects)', () => {
    // pool 101 @ 10% -> floor(10.1) = 10 rake, 91 winnings
    const { rake, winnings } = Movements.settlement('a', 'm', money(101), 1000);
    expect(rake).toBe(10);
    expect(winnings).toBe(91);
    expect(rake + winnings).toBe(101);
  });
});
