import { z } from 'zod';
import type { User } from '../domain/user.js';

export const LoginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'username must be at least 3 characters')
    .max(20, 'username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'username may only contain letters, digits, _'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

/** Public user shape returned over HTTP — never exposes internal fields. */
export interface PublicUser {
  id: string;
  username: string;
  avatar: string;
  rating: number;
}

export const toPublicUser = (user: User): PublicUser => ({
  id: user.id,
  username: user.username,
  avatar: user.avatar,
  rating: user.rating,
});
