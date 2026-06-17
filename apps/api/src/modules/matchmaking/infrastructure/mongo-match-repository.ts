import { money } from '@gamesphere/shared';
import type { Match, MatchStatus } from '../domain/match.js';
import type { MatchRepository } from '../domain/match-repository.js';
import { MatchModel, type MatchDoc } from './match.model.js';

const ACTIVE_STATUSES = ['PENDING', 'ACTIVE'];

const toDomain = (doc: MatchDoc): Match => ({
  id: doc._id,
  roomId: doc.roomId,
  players: doc.players.map((p) => ({ userId: p.userId, seat: p.seat })),
  entryFee: money(doc.entryFee),
  pool: money(doc.pool),
  status: doc.status,
  winnerId: doc.winnerId,
  createdAt: doc.createdAt,
});

export class MongoMatchRepository implements MatchRepository {
  async create(match: Match): Promise<void> {
    await MatchModel.create({
      _id: match.id,
      roomId: match.roomId,
      players: match.players.map((p) => ({ userId: p.userId, seat: p.seat })),
      entryFee: match.entryFee,
      pool: match.pool,
      status: match.status,
      winnerId: match.winnerId,
      createdAt: match.createdAt,
    });
  }

  async findById(matchId: string): Promise<Match | null> {
    const doc = await MatchModel.findById(matchId).lean<MatchDoc>().exec();
    return doc ? toDomain(doc) : null;
  }

  async findActiveForUser(userId: string): Promise<Match | null> {
    const doc = await MatchModel.findOne({
      'players.userId': userId,
      status: { $in: ACTIVE_STATUSES },
    })
      .sort({ createdAt: -1 })
      .lean<MatchDoc>()
      .exec();
    return doc ? toDomain(doc) : null;
  }

  async setStatus(matchId: string, status: MatchStatus): Promise<void> {
    await MatchModel.updateOne({ _id: matchId }, { $set: { status } }).exec();
  }

  async setResult(
    matchId: string,
    winnerId: string | null,
    status: MatchStatus,
  ): Promise<void> {
    await MatchModel.updateOne(
      { _id: matchId },
      { $set: { winnerId, status } },
    ).exec();
  }

  async listRecent(limit: number): Promise<Match[]> {
    const docs = await MatchModel.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<MatchDoc[]>()
      .exec();
    return docs.map(toDomain);
  }
}
