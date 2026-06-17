/**
 * Verifies explicit forfeit: when a player quits an active match, the opponent
 * wins the pool (idempotent settlement) and the ledger stays conserved.
 *   node apps/web/scripts/verify-quit.mjs   (API must be running)
 */
import { io } from 'socket.io-client';

const API = 'http://localhost:4000';
const post = async (path, body, token) =>
  (await (await fetch(`${API}/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body ?? {}),
  })).json()).data;
const get = async (path, token) =>
  (await (await fetch(`${API}/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })).json()).data;

async function main() {
  const t = Date.now();
  const a = await post('/auth/login', { username: `quit_${t}_a` });
  const b = await post('/auth/login', { username: `quit_${t}_b` });
  await post('/matchmaking/join', { entryFee: 10_000 }, a.token);
  await post('/matchmaking/join', { entryFee: 10_000 }, b.token);

  let matchId = null;
  for (let i = 0; i < 20 && !matchId; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    const s = await get('/matchmaking/status', a.token);
    if (s.match) matchId = s.match.id;
  }
  if (!matchId) throw new Error('no match');
  console.log('matched →', matchId);

  const ended = await new Promise((resolve, reject) => {
    const sa = io(API, { auth: { token: a.token }, transports: ['websocket'] });
    const sb = io(API, { auth: { token: b.token }, transports: ['websocket'] });
    let quit = false;
    sa.on('connect', () => sa.emit('game:join', { matchId }));
    sb.on('connect', () => sb.emit('game:join', { matchId }));
    // Player A forfeits as soon as the game is active.
    sa.on('game:state', (s) => {
      if (s.status === 'ACTIVE' && !quit) {
        quit = true;
        setTimeout(() => sa.emit('game:quit', { matchId }), 100);
      }
    });
    sb.on('game:ended', (e) => {
      sa.disconnect();
      sb.disconnect();
      resolve(e);
    });
    setTimeout(() => reject(new Error('timeout')), 20_000);
  });

  console.log('ended:', JSON.stringify(ended));
  if (ended.winnerId !== b.user.id) throw new Error('quitter should NOT win');
  const wallet = await get('/wallet', b.token);
  const integrity = await get('/ops/ledger-integrity');
  console.log('opponent (b) balance:', wallet.balance, '· conserved:', integrity.conserved);
  if (wallet.balance !== 58_000 || !integrity.conserved) throw new Error('settlement wrong');

  console.log('\nQUIT/FORFEIT VERIFIED ✅  quitter loses, opponent paid, ledger = 0');
  process.exit(0);
}
main().catch((e) => {
  console.error('\nFAILED ❌', e);
  process.exit(1);
});
