/**
 * Headless two-player end-to-end check of the realtime stack:
 * register → join queue → matched → socket play (authoritative) → settlement.
 * Run with the API + dev infra up:
 *   node apps/web/scripts/verify-live.mjs
 */
import { io } from 'socket.io-client';

const API = 'http://localhost:4000';

const post = async (path, body, token) => {
  const res = await fetch(`${API}/api${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
  return (await res.json()).data;
};
const get = async (path, token) => {
  const res = await fetch(`${API}/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return (await res.json()).data;
};

const register = (username) => post('/auth/login', { username });

async function main() {
  const stamp = Date.now();
  const a = await register(`bot_${stamp}_a`);
  const b = await register(`bot_${stamp}_b`);
  console.log('registered two players');

  await post('/matchmaking/join', { entryFee: 10_000 }, a.token);
  await post('/matchmaking/join', { entryFee: 10_000 }, b.token);
  console.log('both joined queue');

  // Wait for the worker to pair them.
  let matchId = null;
  for (let i = 0; i < 20 && !matchId; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    const s = await get('/matchmaking/status', a.token);
    if (s.match) matchId = s.match.id;
  }
  if (!matchId) throw new Error('matchmaking did not pair players');
  console.log('matched →', matchId);

  const connect = (player) =>
    new Promise((resolve) => {
      const socket = io(API, {
        auth: { token: player.token },
        transports: ['websocket'],
      });
      const mySeatOf = (state) =>
        state.seats.find((s) => s.userId === player.user.id)?.seat;

      socket.on('connect', () => socket.emit('game:join', { matchId }));
      socket.on('game:state', (state) => {
        const seat = mySeatOf(state);
        if (
          state.status === 'ACTIVE' &&
          state.turnSeat === seat &&
          state.phase === 'AWAITING_ROLL'
        ) {
          socket.emit('game:roll', { matchId });
        }
      });
      socket.on('game:legalMoves', (d) => {
        if (d.moves.length > 0)
          socket.emit('game:move', { matchId, tokenIndex: d.moves[0].tokenIndex });
      });
      socket.on('game:ended', (e) => {
        resolve({ player: player.user.username, ended: e });
        socket.disconnect();
      });
    });

  const [r1] = await Promise.race([
    Promise.all([connect(a), connect(b)]),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 60_000)),
  ]);

  console.log('game ended:', JSON.stringify(r1.ended));
  if (!r1.ended.winnerId) throw new Error('no winner');

  const winnerToken = r1.ended.winnerId === a.user.id ? a.token : b.token;
  const wallet = await get('/wallet', winnerToken);
  const integrity = await get('/ops/ledger-integrity');
  console.log('winner balance:', wallet.balance);
  console.log('ledger conserved:', integrity.conserved, '· total:', integrity.total);
  if (!integrity.conserved) throw new Error('ledger not conserved');

  console.log('\nLIVE E2E PASSED ✅  matchmaking → play → settlement → conserved');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nLIVE E2E FAILED ❌', err);
  process.exit(1);
});
