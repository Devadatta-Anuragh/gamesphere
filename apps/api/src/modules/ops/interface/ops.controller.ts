import type { Request, Response } from 'express';
import { sendOk } from '@/infrastructure/http/http-helpers.js';
import type { GetOverview } from '../application/get-overview.js';
import type { GetMetrics } from '../application/get-metrics.js';
import type { GetLedgerIntegrity } from '@/modules/wallet/application/get-ledger-integrity.js';

export class OpsController {
  constructor(
    private readonly getOverview: GetOverview,
    private readonly getMetrics: GetMetrics,
    private readonly getLedgerIntegrity: GetLedgerIntegrity,
  ) {}

  overview = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.getOverview.execute();
    if (!result.ok) throw result.error;
    sendOk(res, result.value);
  };

  metrics = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.getMetrics.execute();
    if (!result.ok) throw result.error;
    sendOk(res, result.value);
  };

  ledgerIntegrity = async (_req: Request, res: Response): Promise<void> => {
    const result = await this.getLedgerIntegrity.execute();
    if (!result.ok) throw result.error;
    sendOk(res, result.value);
  };
}
