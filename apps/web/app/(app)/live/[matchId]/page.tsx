'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Dice5 } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useSocket } from '@/lib/socket';
import { formatMoney, formatTime, shortId } from '@/lib/format';
import { Card, CardBody, CardHeader, Badge, StatusDot } from '@/components/ui/primitives';
import { Button } from '@/components/ui/Button';
import { LudoBoard, type BoardSeat } from '@/components/board/LudoBoard';
import { COLORS } from '@/components/board/board-geometry';

interface GameState {
  matchId: string;
  status: string;
  phase: string;
  turnSeat: number;
  lastRoll: number | null;
  winner: number | null;
  pool: number;
  seats: (BoardSeat & { username: string; connected: boolean })[];
  startOffset: Record<number, number>;
  diceCommitment: string;
}
interface LegalMove {
  tokenIndex: number;
  from: number;
  to: number;
  finishes: boolean;
  captures: unknown[];
}
interface Ended {
  winnerId: string | null;
  winnerName: string | null;
  winnings: number;
  rake: number;
  dice: { commitment: string; serverSeed: string; rolls: number };
}
interface LogLine {
  id: string;
  text: string;
  at: string;
}

export default function LiveMatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  const [state, setState] = useState<GameState | null>(null);
  const [legal, setLegal] = useState<LegalMove[]>([]);
  const [ended, setEnded] = useState<Ended | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const prevTurn = useRef<number | null>(null);

  const addLog = (text: string) =>
    setLog((l) =>
      [{ id: Math.random().toString(36).slice(2), text, at: new Date().toISOString() }, ...l].slice(0, 30),
    );

  useEffect(() => {
    if (!socket) return;
    socket.emit('game:join', { matchId });

    const onState = (s: GameState) => {
      setState(s);
      if (prevTurn.current !== null && prevTurn.current !== s.turnSeat) {
        addLog(`Turn → seat ${s.turnSeat}`);
      }
      prevTurn.current = s.turnSeat;
      if (s.phase !== 'AWAITING_MOVE') setLegal([]);
    };
    const onRolled = (d: { seat: number; dice: number; turnPassed: boolean }) =>
      addLog(`Seat ${d.seat} rolled ${d.dice}${d.turnPassed ? ' (no move)' : ''}`);
    const onLegal = (d: { moves: LegalMove[] }) => setLegal(d.moves);
    const onEnded = (e: Ended) => {
      setEnded(e);
      addLog(e.winnerName ? `Game over — winner ${e.winnerName}` : 'Game over');
    };
    const onErr = (e: { message: string }) => addLog(`⚠ ${e.message}`);

    socket.on('game:state', onState);
    socket.on('game:rolled', onRolled);
    socket.on('game:legalMoves', onLegal);
    socket.on('game:ended', onEnded);
    socket.on('game:error', onErr);
    return () => {
      socket.off('game:state', onState);
      socket.off('game:rolled', onRolled);
      socket.off('game:legalMoves', onLegal);
      socket.off('game:ended', onEnded);
      socket.off('game:error', onErr);
    };
  }, [socket, matchId]);

  const mySeat = state?.seats.find((s) => s.userId === user?.id)?.seat;
  const myTurn = state != null && mySeat === state.turnSeat && state.status === 'ACTIVE';
  const canRoll = myTurn && state?.phase === 'AWAITING_ROLL';
  const canMove = myTurn && state?.phase === 'AWAITING_MOVE';

  const roll = () => socket?.emit('game:roll', { matchId });
  const move = (tokenIndex: number) => socket?.emit('game:move', { matchId, tokenIndex });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Live Match</h1>
          <p className="font-mono text-xs text-muted">
            room {shortId(matchId)} · authoritative server · WebSocket
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={state?.status === 'ACTIVE' ? 'green' : 'amber'}>
            {state?.status ?? 'connecting'}
          </Badge>
          {state && (
            <Badge tone="brand">pool {formatMoney(state.pool)}</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Board */}
        <div className="lg:col-span-3">
          <Card>
            <CardBody>
              {state ? (
                <LudoBoard
                  seats={state.seats}
                  startOffset={state.startOffset}
                  turnSeat={state.turnSeat}
                />
              ) : (
                <div className="grid h-[460px] place-items-center text-sm text-muted">
                  {connected ? 'Joining match…' : 'Connecting…'}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Players" />
            <CardBody className="space-y-2">
              {state?.seats.map((s) => (
                <div key={s.seat} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <StatusDot tone={s.connected ? 'green' : 'red'} />
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full border border-white/40"
                      style={{ background: COLORS[state.startOffset[s.seat] ?? 0] ?? '#94a3b8' }}
                    />
                    {s.userId === user?.id ? 'You' : (s.username ?? 'Opponent')}
                    {s.seat === state.turnSeat && <Badge tone="brand">turn</Badge>}
                  </span>
                  <span className="font-mono text-[11px] text-muted">
                    home {s.tokens.filter((t) => t === 57).length}/4
                  </span>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Your Turn" />
            <CardBody className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-lg border border-line bg-panel font-mono text-2xl">
                  {state?.lastRoll ?? '–'}
                </div>
                <Button onClick={roll} disabled={!canRoll}>
                  <Dice5 size={16} /> Roll Dice
                </Button>
              </div>
              {canMove && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted">Choose a token to move:</p>
                  <div className="flex flex-wrap gap-2">
                    {legal.map((m) => (
                      <button
                        key={m.tokenIndex}
                        onClick={() => move(m.tokenIndex)}
                        className="rounded-lg border border-brand/40 bg-brand/10 px-3 py-1.5 font-mono text-xs text-brand hover:bg-brand/20"
                      >
                        Token {m.tokenIndex + 1} → {m.to === 57 ? 'HOME' : m.to}
                        {m.captures.length > 0 ? ' ✦capture' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!myTurn && state?.status === 'ACTIVE' && (
                <p className="text-xs text-muted">Waiting for opponent…</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Event Stream" subtitle="server-authoritative" />
            <ul className="max-h-48 overflow-y-auto px-4 py-2 text-xs">
              {log.map((l) => (
                <li key={l.id} className="flex justify-between gap-2 py-1 font-mono text-muted">
                  <span className="text-ink">{l.text}</span>
                  <span>{formatTime(l.at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* Provably-fair reveal */}
      {ended && (
        <Card className="border-brand/40">
          <CardHeader
            title={
              ended.winnerId === user?.id
                ? '🏆 You won!'
                : ended.winnerName
                  ? `🏆 ${ended.winnerName} won`
                  : 'Match ended'
            }
            subtitle="Settlement is atomic + idempotent · dice are provably fair"
          />
          <CardBody className="space-y-3 text-sm">
            <div className="flex gap-6">
              <div>
                <div className="text-xs text-muted">Winnings</div>
                <div className="font-mono text-emerald-300">{formatMoney(ended.winnings)}</div>
              </div>
              <div>
                <div className="text-xs text-muted">House rake</div>
                <div className="font-mono text-amber-300">{formatMoney(ended.rake)}</div>
              </div>
              <div>
                <div className="text-xs text-muted">Rolls</div>
                <div className="font-mono">{ended.dice.rolls}</div>
              </div>
            </div>
            <div className="rounded-lg border border-line bg-panel p-3 font-mono text-[11px] leading-relaxed text-muted">
              <div>commitment (pre-game): <span className="text-ink">{ended.dice.commitment.slice(0, 24)}…</span></div>
              <div>server seed (revealed): <span className="text-brand">{ended.dice.serverSeed.slice(0, 24)}…</span></div>
              <div className="mt-1 text-[10px]">sha256(serverSeed) === commitment → every roll is verifiable</div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
