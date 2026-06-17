'use client';

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from './api';

/* ----------------------------------------------------------------- types */
export interface Overview {
  activePlayers: number;
  activeMatches: number;
  queueLength: number;
  wsConnections: number;
  health: {
    api: string;
    redis: string;
    mongo: string;
    ws: string;
    mongoPingMs: number;
  };
}

export interface Metrics {
  rps: number;
  avgResponseMs: number;
  errorRate: number;
  totalRequests: number;
  redisHitRatio: number | null;
  mongoPingMs: number;
  wsConnections: number;
  series: { t: number; requests: number; errors: number }[];
}

export interface LedgerIntegrity {
  total: number;
  byAccountType: { type: string; balance: number }[];
  conserved: boolean;
}

export interface WalletEntry {
  id: string;
  direction: string;
  reason: string;
  amount: number;
  createdAt: string;
}
export interface WalletView {
  balance: number;
  entries: WalletEntry[];
}

export interface LedgerTransfer {
  from: string;
  to: string;
  amount: number;
  reason: string;
}
export interface LedgerTx {
  id: string;
  type: string;
  createdAt: string;
  transfers: LedgerTransfer[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  rating: number;
}

export interface MatchDto {
  id: string;
  roomId: string;
  status: string;
  entryFee: number;
  pool: number;
  players: { userId: string; seat: number }[];
}
export interface MatchStatus {
  state: 'idle' | 'queued' | 'matched';
  match: MatchDto | null;
  queuedTiers: number[];
}

/* ----------------------------------------------------------------- hooks */
export const useOverview = () =>
  useQuery({
    queryKey: ['ops', 'overview'],
    queryFn: async () => unwrap<Overview>(await api.get('/ops/overview')),
    refetchInterval: 2000,
  });

export const useMetrics = () =>
  useQuery({
    queryKey: ['ops', 'metrics'],
    queryFn: async () => unwrap<Metrics>(await api.get('/ops/metrics')),
    refetchInterval: 2000,
  });

export const useLedgerIntegrity = () =>
  useQuery({
    queryKey: ['ops', 'ledger-integrity'],
    queryFn: async () =>
      unwrap<LedgerIntegrity>(await api.get('/ops/ledger-integrity')),
    refetchInterval: 4000,
  });

export const useWallet = () =>
  useQuery({
    queryKey: ['wallet'],
    queryFn: async () => unwrap<WalletView>(await api.get('/wallet')),
    refetchInterval: 4000,
  });

export const useLedger = () =>
  useQuery({
    queryKey: ['wallet', 'ledger'],
    queryFn: async () =>
      unwrap<{ transactions: LedgerTx[] }>(await api.get('/wallet/ledger')),
    refetchInterval: 4000,
  });

export const useLeaderboard = (scope: 'global' | 'daily' | 'weekly') =>
  useQuery({
    queryKey: ['leaderboard', scope],
    queryFn: async () =>
      unwrap<{ scope: string; entries: LeaderboardEntry[] }>(
        await api.get(`/leaderboard?scope=${scope}&limit=20`),
      ),
    refetchInterval: 4000,
  });

export const useMatchStatus = () =>
  useQuery({
    queryKey: ['matchmaking', 'status'],
    queryFn: async () => unwrap<MatchStatus>(await api.get('/matchmaking/status')),
    refetchInterval: 1500,
  });
