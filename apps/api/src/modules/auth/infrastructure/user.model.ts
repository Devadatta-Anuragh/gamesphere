import { Schema, model } from 'mongoose';

/** Mongo document shape. `_id` holds our application id (not an ObjectId). */
export interface UserDoc {
  _id: string;
  username: string;
  avatar: string;
  rating: number;
  createdAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    _id: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    avatar: { type: String, required: true },
    rating: { type: Number, required: true, default: 1000, index: true },
    createdAt: { type: Date, required: true },
  },
  { versionKey: false, _id: false },
);

export const UserModel = model<UserDoc>('User', userSchema);
