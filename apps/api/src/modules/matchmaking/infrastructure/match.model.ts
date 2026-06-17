import { Schema, model } from 'mongoose';
import { MatchStatus } from '../domain/match.js';

export interface MatchPlayerDoc {
  userId: string;
  seat: number;
}

export interface MatchDoc {
  _id: string;
  roomId: string;
  players: MatchPlayerDoc[];
  entryFee: number;
  pool: number;
  status: MatchStatus;
  winnerId: string | null;
  createdAt: Date;
}

const matchSchema = new Schema<MatchDoc>(
  {
    _id: { type: String, required: true },
    roomId: { type: String, required: true },
    players: [
      {
        _id: false,
        userId: { type: String, required: true },
        seat: { type: Number, required: true },
      },
    ],
    entryFee: { type: Number, required: true },
    pool: { type: Number, required: true },
    status: { type: String, enum: Object.values(MatchStatus), required: true },
    winnerId: { type: String, default: null },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false, _id: false },
);
// Find a user's in-flight match quickly.
matchSchema.index({ 'players.userId': 1, status: 1 });
matchSchema.index({ createdAt: -1 });

export const MatchModel = model<MatchDoc>('Match', matchSchema);
