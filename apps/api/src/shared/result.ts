/**
 * A lightweight Result type for representing expected, domain-level failures
 * (insufficient balance, illegal move, ...) without throwing. Throwing is
 * reserved for *unexpected* / programmer errors. This makes failure paths
 * explicit in the type signature — the caller cannot forget to handle them.
 */
export type Result<T, E = AppErrorLike> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

/** Structural shape every domain error satisfies (see AppError). */
export interface AppErrorLike {
  readonly code: string;
  readonly message: string;
}

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const isOk = <T, E>(
  r: Result<T, E>,
): r is { ok: true; value: T } => r.ok;

export const isErr = <T, E>(
  r: Result<T, E>,
): r is { ok: false; error: E } => !r.ok;

/** Unwrap a Result, throwing if it is an error. Use only when failure is a bug. */
export const unwrap = <T, E>(r: Result<T, E>): T => {
  if (r.ok) return r.value;
  throw new Error(`Called unwrap on an error Result: ${JSON.stringify(r.error)}`);
};
