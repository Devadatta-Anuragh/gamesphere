import type { Request, Response } from 'express';
import { sendOk } from '@/infrastructure/http/http-helpers.js';
import { AppError } from '@/shared/errors.js';
import type { GetProfile } from '../application/get-profile.js';
import { toPublicUser } from './dto.js';

export class UserController {
  constructor(private readonly getProfile: GetProfile) {}

  me = async (req: Request, res: Response): Promise<void> => {
    // The auth guard guarantees userId; this is a defensive invariant check.
    if (!req.userId) {
      throw AppError.unauthorized('NOT_AUTHENTICATED', 'Not authenticated');
    }
    const result = await this.getProfile.execute(req.userId);
    if (!result.ok) throw result.error;
    sendOk(res, { user: toPublicUser(result.value) });
  };
}
