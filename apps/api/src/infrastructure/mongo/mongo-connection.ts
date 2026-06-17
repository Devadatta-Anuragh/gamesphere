import mongoose from 'mongoose';
import type { Logger } from '@/shared/logger.js';

/**
 * Owns the single Mongoose connection lifecycle. Multi-document transactions
 * (used by the wallet ledger) require the server to be a replica set — the dev
 * docker-compose runs a single-node replica set for exactly this reason.
 */
export const connectMongo = async (
  uri: string,
  logger: Logger,
): Promise<typeof mongoose> => {
  mongoose.connection.on('error', (err) =>
    logger.error({ err }, 'Mongo connection error'),
  );
  mongoose.connection.on('disconnected', () =>
    logger.warn('Mongo disconnected'),
  );

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  logger.info('Mongo connected');
  return mongoose;
};

export const disconnectMongo = async (): Promise<void> => {
  await mongoose.disconnect();
};
