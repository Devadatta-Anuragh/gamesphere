import type { z, ZodTypeAny } from 'zod';
import { AppError } from '@/shared/errors.js';

/**
 * Parses unknown input against a Zod schema, converting failures into a uniform
 * VALIDATION AppError. Centralizing this keeps controllers free of zod details.
 * Returns the schema's OUTPUT type (defaults/coercions applied).
 */
export const parse = <S extends ZodTypeAny>(
  schema: S,
  input: unknown,
): z.infer<S> => {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw AppError.validation('VALIDATION_ERROR', 'Invalid request', {
      issues: result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }
  return result.data;
};
