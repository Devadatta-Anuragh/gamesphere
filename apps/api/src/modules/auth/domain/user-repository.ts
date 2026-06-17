import type { UserId } from '@gamesphere/shared';
import type { User } from './user.js';

/**
 * Persistence port for the User aggregate. The application layer depends on
 * this interface; the Mongo adapter implements it (Dependency Inversion).
 */
export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  /** Throws AppError.conflict (USERNAME_TAKEN) on unique-index violation. */
  insert(user: User): Promise<void>;
  updateRating(userId: UserId, rating: number): Promise<void>;
  count(): Promise<number>;
}
