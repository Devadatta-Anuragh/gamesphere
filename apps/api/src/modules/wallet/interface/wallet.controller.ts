import type { Request, Response } from 'express';
import { money } from '@gamesphere/shared';
import { sendOk } from '@/infrastructure/http/http-helpers.js';
import { parse } from '@/infrastructure/http/validate.js';
import { AppError } from '@/shared/errors.js';
import type { IdGenerator } from '@/shared/id-generator.js';
import { EntryReason } from '../domain/ledger.js';
import type { CreditFunds } from '../application/credit-funds.js';
import type { GetWallet } from '../application/get-wallet.js';
import { DepositSchema, toWalletDto } from './dto.js';

export class WalletController {
  constructor(
    private readonly getWallet: GetWallet,
    private readonly creditFunds: CreditFunds,
    private readonly ids: IdGenerator,
  ) {}

  private requireUser(req: Request): string {
    if (!req.userId) {
      throw AppError.unauthorized('NOT_AUTHENTICATED', 'Not authenticated');
    }
    return req.userId;
  }

  view = async (req: Request, res: Response): Promise<void> => {
    const userId = this.requireUser(req);
    const result = await this.getWallet.execute(userId);
    if (!result.ok) throw result.error;
    sendOk(res, toWalletDto(result.value));
  };

  deposit = async (req: Request, res: Response): Promise<void> => {
    const userId = this.requireUser(req);
    const { amount, reference } = parse(DepositSchema, req.body);

    const result = await this.creditFunds.execute({
      userId,
      amount: money(amount),
      reason: EntryReason.Deposit,
      // Use the client reference for idempotency; otherwise treat each call as unique.
      idempotencyKey: `deposit:${userId}:${reference ?? this.ids.generate()}`,
    });
    if (!result.ok) throw result.error;
    sendOk(res, { balance: result.value.balance });
  };
}
