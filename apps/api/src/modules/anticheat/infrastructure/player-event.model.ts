import { Schema, model } from 'mongoose';
import { PlayerEventType } from '../domain/player-event.js';

export interface PlayerEventDoc {
  _id: string;
  userId: string;
  type: PlayerEventType;
  matchId: string | null;
  createdAt: Date;
}

const schema = new Schema<PlayerEventDoc>(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    type: { type: String, enum: Object.values(PlayerEventType), required: true },
    matchId: { type: String, default: null },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false, _id: false },
);
schema.index({ userId: 1, createdAt: -1 });

export const PlayerEventModel = model<PlayerEventDoc>('PlayerEvent', schema);
