import type { AppErrorLike } from './result.js';

/**
 * Maps directly onto HTTP status families and is reused by the WebSocket layer
 * for error payloads. Domain code references the enum, never raw numbers.
 */
export enum ErrorKind {
  Validation = 'VALIDATION', // 400 — bad input
  Unauthorized = 'UNAUTHORIZED', // 401 — missing/invalid auth
  Forbidden = 'FORBIDDEN', // 403 — authenticated but not allowed
  NotFound = 'NOT_FOUND', // 404
  Conflict = 'CONFLICT', // 409 — invariant/idempotency violation
  Unprocessable = 'UNPROCESSABLE', // 422 — valid input, illegal in current state
  Internal = 'INTERNAL', // 500
}

const STATUS_BY_KIND: Record<ErrorKind, number> = {
  [ErrorKind.Validation]: 400,
  [ErrorKind.Unauthorized]: 401,
  [ErrorKind.Forbidden]: 403,
  [ErrorKind.NotFound]: 404,
  [ErrorKind.Conflict]: 409,
  [ErrorKind.Unprocessable]: 422,
  [ErrorKind.Internal]: 500,
};

/**
 * The single error type the whole application uses. `code` is a stable,
 * machine-readable string (e.g. INSUFFICIENT_FUNDS); `kind` decides transport
 * status; `details` carries structured context for logs/clients.
 */
export class AppError extends Error implements AppErrorLike {
  readonly kind: ErrorKind;
  readonly code: string;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    kind: ErrorKind,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.kind = kind;
    this.code = code;
    if (details) this.details = details;
  }

  get httpStatus(): number {
    return STATUS_BY_KIND[this.kind];
  }

  static validation(code: string, message: string, details?: Record<string, unknown>) {
    return new AppError(ErrorKind.Validation, code, message, details);
  }
  static unauthorized(code: string, message: string) {
    return new AppError(ErrorKind.Unauthorized, code, message);
  }
  static forbidden(code: string, message: string) {
    return new AppError(ErrorKind.Forbidden, code, message);
  }
  static notFound(code: string, message: string, details?: Record<string, unknown>) {
    return new AppError(ErrorKind.NotFound, code, message, details);
  }
  static conflict(code: string, message: string, details?: Record<string, unknown>) {
    return new AppError(ErrorKind.Conflict, code, message, details);
  }
  static unprocessable(code: string, message: string, details?: Record<string, unknown>) {
    return new AppError(ErrorKind.Unprocessable, code, message, details);
  }
  static internal(code: string, message: string, details?: Record<string, unknown>) {
    return new AppError(ErrorKind.Internal, code, message, details);
  }
}

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;
