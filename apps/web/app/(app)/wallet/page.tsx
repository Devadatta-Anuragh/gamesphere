'use client';

import { ArrowRight, ShieldCheck } from 'lucide-react';
import {
  useWallet,
  useLedger,
  useLedgerIntegrity,
  type WalletEntry,
} from '@/lib/api-hooks';
import { formatMoney, formatTime } from '@/lib/format';
import {
  Card,
  CardBody,
  CardHeader,
  Badge,
  StatCard,
} from '@/components/ui/primitives';

const sumByReason = (entries: WalletEntry[], reason: string) =>
  entries.filter((e) => e.reason === reason).reduce((s, e) => s + e.amount, 0);

const REASON_TONE: Record<string, 'green' | 'amber' | 'red' | 'cyan' | 'slate'> = {
  DEPOSIT: 'cyan',
  SIGNUP_BONUS: 'cyan',
  WINNINGS: 'green',
  ENTRY_FEE_HOLD: 'amber',
  ENTRY_FEE_REFUND: 'slate',
  RAKE: 'red',
};

export default function WalletPage() {
  const { data: wallet } = useWallet();
  const { data: ledger } = useLedger();
  const { data: integrity } = useLedgerIntegrity();

  const entries = wallet?.entries ?? [];
  const winnings = sumByReason(entries, 'WINNINGS');
  const stakes = sumByReason(entries, 'ENTRY_FEE_HOLD');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Wallet</h1>
        <p className="text-sm text-muted">
          Double-entry ledger. Balance is derived from immutable entries — never
          stored.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Balance" value={formatMoney(wallet?.balance ?? 0)} tone="brand" />
        <StatCard label="Total Winnings" value={formatMoney(winnings)} tone="green" />
        <StatCard label="Total Staked" value={formatMoney(stakes)} tone="amber" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Ledger journal */}
        <Card>
          <CardHeader title="Ledger Journal" subtitle="actual account-to-account transfers" />
          <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
            {(ledger?.transactions ?? []).map((tx) => (
              <li key={tx.id} className="px-4 py-2.5">
                <div className="mb-1 flex items-center justify-between">
                  <Badge tone="slate">{tx.type}</Badge>
                  <span className="font-mono text-[11px] text-muted">
                    {formatTime(tx.createdAt)}
                  </span>
                </div>
                {tx.transfers.map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 font-mono text-xs text-muted"
                  >
                    <span className="text-ink">{t.from}</span>
                    <ArrowRight size={12} />
                    <span className="text-ink">{t.to}</span>
                    <span className="ml-auto text-brand">{formatMoney(t.amount)}</span>
                  </div>
                ))}
              </li>
            ))}
            {ledger && ledger.transactions.length === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted">
                No transactions yet.
              </li>
            )}
          </ul>
        </Card>

        {/* Transaction history + integrity */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Transaction History" />
            <ul className="max-h-56 divide-y divide-line overflow-y-auto">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-4 py-2">
                  <Badge tone={REASON_TONE[e.reason] ?? 'slate'}>{e.reason}</Badge>
                  <span
                    className={`font-mono text-sm ${
                      e.direction === 'CREDIT' ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {e.direction === 'CREDIT' ? '+' : '−'}
                    {formatMoney(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className={integrity?.conserved ? 'border-emerald-500/40' : 'border-red-500/40'}>
            <CardBody className="flex items-center gap-4">
              <ShieldCheck
                size={32}
                className={integrity?.conserved ? 'text-emerald-400' : 'text-red-400'}
              />
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink">
                  {integrity?.conserved ? 'Money Conserved ✓' : 'Imbalance detected!'}
                </div>
                <div className="font-mono text-xs text-muted">
                  Σ all account balances = {integrity?.total ?? '…'}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {integrity?.byAccountType.map((a) => (
                    <span
                      key={a.type}
                      className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted"
                    >
                      {a.type} {formatMoney(a.balance)}
                    </span>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
