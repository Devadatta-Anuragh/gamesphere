import { asUserId, type UserId } from '@gamesphere/shared';
import { AppError } from '@/shared/errors.js';
import type { UserRepository } from '../domain/user-repository.js';
import { createUser, type User } from '../domain/user.js';
import { UserModel, type UserDoc } from './user.model.js';

const MONGO_DUPLICATE_KEY = 11000;

const toDomain = (doc: UserDoc): User =>
  createUser({
    id: asUserId(doc._id),
    username: doc.username,
    avatar: doc.avatar,
    rating: doc.rating,
    createdAt: doc.createdAt,
  });

export class MongoUserRepository implements UserRepository {
  async findById(id: UserId): Promise<User | null> {
    const doc = await UserModel.findById(id).lean<UserDoc>().exec();
    return doc ? toDomain(doc) : null;
  }

  async findByUsername(username: string): Promise<User | null> {
    const doc = await UserModel.findOne({ username }).lean<UserDoc>().exec();
    return doc ? toDomain(doc) : null;
  }

  async insert(user: User): Promise<void> {
    try {
      await UserModel.create({
        _id: user.id,
        username: user.username,
        avatar: user.avatar,
        rating: user.rating,
        createdAt: user.createdAt,
      });
    } catch (e) {
      if (isDuplicateKey(e)) {
        throw AppError.conflict('USERNAME_TAKEN', 'Username already taken', {
          username: user.username,
        });
      }
      throw e;
    }
  }

  async updateRating(userId: UserId, rating: number): Promise<void> {
    await UserModel.updateOne({ _id: userId }, { $set: { rating } }).exec();
  }

  count(): Promise<number> {
    return UserModel.estimatedDocumentCount().exec();
  }
}

const isDuplicateKey = (e: unknown): boolean =>
  typeof e === 'object' &&
  e !== null &&
  'code' in e &&
  (e as { code?: number }).code === MONGO_DUPLICATE_KEY;
