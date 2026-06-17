import type {
  PlayerEvent,
  PlayerEventRepository,
} from '../domain/player-event.js';
import { PlayerEventModel, type PlayerEventDoc } from './player-event.model.js';

export class MongoPlayerEventRepository implements PlayerEventRepository {
  async record(event: PlayerEvent): Promise<void> {
    await PlayerEventModel.create({
      _id: event.id,
      userId: event.userId,
      type: event.type,
      matchId: event.matchId,
      createdAt: event.createdAt,
    });
  }

  async recent(userId: string, limit: number): Promise<PlayerEvent[]> {
    const docs = await PlayerEventModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<PlayerEventDoc[]>()
      .exec();
    return docs.map((d) => ({
      id: d._id,
      userId: d.userId,
      type: d.type,
      matchId: d.matchId,
      createdAt: d.createdAt,
    }));
  }
}
