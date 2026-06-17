import { describe, expect, it } from 'vitest';
import { applyRakeBps, money } from '@gamesphere/shared';
import { err, isErr, isOk, ok } from '@/shared/result.js';
import { AppError, ErrorKind } from '@/shared/errors.js';

describe('toolchain smoke', () => {
  it('resolves the shared workspace package', () => {
    const { rake, net } = applyRakeBps(money(10_000), 1000); // 10%
    expect(rake).toBe(1000);
    expect(net).toBe(9000);
  });

  it('rejects non-integer money', () => {
    expect(() => money(1.5)).toThrow();
  });

  it('Result helpers narrow correctly', () => {
    expect(isOk(ok(42))).toBe(true);
    expect(isErr(err('boom'))).toBe(true);
  });

  it('AppError carries an http status', () => {
    const e = AppError.conflict('DUP', 'duplicate');
    expect(e.kind).toBe(ErrorKind.Conflict);
    expect(e.httpStatus).toBe(409);
  });
});
