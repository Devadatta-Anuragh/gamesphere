import type { Request, Response } from 'express';
import { sendOk } from '@/infrastructure/http/http-helpers.js';
import { parse } from '@/infrastructure/http/validate.js';
import { AppError } from '@/shared/errors.js';
import type { JoinQueue } from '../application/join-queue.js';
import type { LeaveQueue } from '../application/leave-queue.js';
import type { GetMatchmakingStatus } from '../application/get-status.js';
import { JoinSchema, LeaveSchema, toStatusDto } from './dto.js';

export class MatchmakingController {
  constructor(
    private readonly joinQueue: JoinQueue,
    private readonly leaveQueue: LeaveQueue,
    private readonly getStatus: GetMatchmakingStatus,
  ) {}

  private requireUser(req: Request): string {
    if (!req.userId) {
      throw AppError.unauthorized('NOT_AUTHENTICATED', 'Not authenticated');
    }
    return req.userId;
  }

  join = async (req: Request, res: Response): Promise<void> => {
    const userId = this.requireUser(req);
    const { entryFee } = parse(JoinSchema, req.body);
    const result = await this.joinQueue.execute(userId, entryFee);
    if (!result.ok) throw result.error;
    sendOk(res, result.value);
  };

  leave = async (req: Request, res: Response): Promise<void> => {
    const userId = this.requireUser(req);
    const { entryFee } = parse(LeaveSchema, req.body);
    const result = await this.leaveQueue.execute(userId, entryFee);
    if (!result.ok) throw result.error;
    sendOk(res, { status: 'left' });
  };

  status = async (req: Request, res: Response): Promise<void> => {
    const userId = this.requireUser(req);
    const result = await this.getStatus.execute(userId);
    if (!result.ok) throw result.error;
    sendOk(res, toStatusDto(result.value));
  };
}
