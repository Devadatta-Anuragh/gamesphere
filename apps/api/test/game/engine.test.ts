import { describe, expect, it } from 'vitest';
import {
  applyMove,
  applyRoll,
  legalMoves,
} from '@/modules/game/domain/ludo/engine.js';
import {
  TurnPhase,
  createInitialState,
} from '@/modules/game/domain/ludo/state.js';
import { FINISH, YARD } from '@/modules/game/domain/ludo/board.js';
import { withTokens } from '../helpers/ludo.js';

const newGame = () => createInitialState(2, 0);

describe('Ludo engine — setup', () => {
  it('starts with all tokens in the yard, seat 0 to roll', () => {
    const s = newGame();
    expect(s.turnSeat).toBe(0);
    expect(s.phase).toBe(TurnPhase.AwaitingRoll);
    expect(s.tokens[0]).toEqual([YARD, YARD, YARD, YARD]);
    expect(s.tokens[1]).toEqual([YARD, YARD, YARD, YARD]);
    // 2 players sit opposite each other on the ring.
    expect(s.startOffset[0]).toBe(0);
    expect(s.startOffset[1]).toBe(26);
  });
});

describe('Ludo engine — leaving the yard', () => {
  it('cannot move from the yard without a 6', () => {
    expect(legalMoves(newGame(), 4)).toHaveLength(0);
  });

  it('a non-6 with no movable token passes the turn', () => {
    const r = applyRoll(newGame(), 4);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.turnPassed).toBe(true);
      expect(r.value.reason).toBe('NO_LEGAL_MOVES');
      expect(r.value.state.turnSeat).toBe(1);
    }
  });

  it('a 6 lets a token leave the yard and grants an extra turn', () => {
    const rolled = applyRoll(newGame(), 6);
    expect(rolled.ok && rolled.value.state.phase).toBe(TurnPhase.AwaitingMove);

    const moved = applyMove(rolled.ok ? rolled.value.state : newGame(), 0);
    expect(moved.ok).toBe(true);
    if (moved.ok) {
      expect(moved.value.state.tokens[0]![0]).toBe(1); // on the start cell
      expect(moved.value.extraTurn).toBe(true); // rolled a 6
      expect(moved.value.state.turnSeat).toBe(0); // same player
      expect(moved.value.state.phase).toBe(TurnPhase.AwaitingRoll);
    }
  });
});

describe('Ludo engine — movement, finishing, overshoot', () => {
  it('requires landing exactly on home (overshoot is illegal)', () => {
    const s = withTokens(newGame(), 0, [55, YARD, YARD, YARD]);
    expect(legalMoves(s, 2).some((m) => m.tokenIndex === 0)).toBe(true); // 55+2=57
    expect(legalMoves(s, 3).some((m) => m.tokenIndex === 0)).toBe(false); // 58 > 57
  });

  it('finishing a token grants an extra turn', () => {
    const s = withTokens(newGame(), 0, [55, YARD, YARD, YARD]);
    const rolled = applyRoll(s, 2);
    const moved = applyMove(rolled.ok ? rolled.value.state : s, 0);
    expect(moved.ok).toBe(true);
    if (moved.ok) {
      expect(moved.value.finishedToken).toBe(true);
      expect(moved.value.state.tokens[0]![0]).toBe(FINISH);
      expect(moved.value.extraTurn).toBe(true);
    }
  });

  it('declares a winner when all four tokens reach home', () => {
    const s = withTokens(newGame(), 0, [FINISH, FINISH, FINISH, 55]);
    const rolled = applyRoll(s, 2);
    const moved = applyMove(rolled.ok ? rolled.value.state : s, 3);
    expect(moved.ok).toBe(true);
    if (moved.ok) {
      expect(moved.value.winner).toBe(0);
      expect(moved.value.state.phase).toBe(TurnPhase.Finished);
    }
  });

  it('a plain move passes the turn to the next player', () => {
    const s = withTokens(newGame(), 0, [10, YARD, YARD, YARD]);
    const rolled = applyRoll(s, 3); // 10 -> 13, no capture, not a six
    const moved = applyMove(rolled.ok ? rolled.value.state : s, 0);
    if (moved.ok) {
      expect(moved.value.extraTurn).toBe(false);
      expect(moved.value.state.turnSeat).toBe(1);
    }
  });
});

describe('Ludo engine — captures', () => {
  it('captures an opponent on a non-safe cell and sends it to the yard', () => {
    // seat1 token at progress 5 -> absolute cell 30 (not safe).
    // seat0 token at progress 28 + dice 3 -> progress 31 -> absolute cell 30.
    let s = withTokens(newGame(), 0, [28, YARD, YARD, YARD]);
    s = withTokens(s, 1, [5, YARD, YARD, YARD]);
    const rolled = applyRoll(s, 3);
    expect(rolled.ok).toBe(true);
    const moved = applyMove(rolled.ok ? rolled.value.state : s, 0);
    expect(moved.ok).toBe(true);
    if (moved.ok) {
      expect(moved.value.captured).toEqual([{ seat: 1, tokenIndex: 0 }]);
      expect(moved.value.state.tokens[1]![0]).toBe(YARD); // sent home
      expect(moved.value.extraTurn).toBe(true); // capture grants extra turn
    }
  });

  it('does NOT capture on a safe cell', () => {
    // seat1 token at progress 35 -> absolute cell 8 (a safe star cell).
    // seat0 token at progress 6 + dice 3 -> progress 9 -> absolute cell 8.
    let s = withTokens(newGame(), 0, [6, YARD, YARD, YARD]);
    s = withTokens(s, 1, [35, YARD, YARD, YARD]);
    const moves = legalMoves(s, 3);
    const move = moves.find((m) => m.tokenIndex === 0);
    expect(move?.captures).toEqual([]);
  });
});

describe('Ludo engine — rules guards', () => {
  it('rejects rolling while awaiting a move', () => {
    const rolled = applyRoll(newGame(), 6);
    const state = rolled.ok ? rolled.value.state : newGame();
    const again = applyRoll(state, 3);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.error.code).toBe('WRONG_PHASE');
  });

  it('rejects an out-of-range dice value', () => {
    const r = applyRoll(newGame(), 7);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('INVALID_DICE');
  });

  it('rejects an illegal token move', () => {
    const rolled = applyRoll(newGame(), 6); // only yard-exits are legal
    const state = rolled.ok ? rolled.value.state : newGame();
    // token 0 can exit, but pretend the client sends a token that cannot move...
    const s2 = withTokens(state, 0, [YARD, FINISH, FINISH, FINISH]);
    const bad = applyMove(s2, 1); // token 1 is already home
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error.code).toBe('ILLEGAL_MOVE');
  });

  it('forfeits the turn after three consecutive sixes', () => {
    let s = newGame();
    // First six: exit a token.
    let r = applyRoll(s, 6);
    s = (r as Extract<typeof r, { ok: true }>).value.state;
    let m = applyMove(s, 0);
    s = (m as Extract<typeof m, { ok: true }>).value.state;
    // Second six.
    r = applyRoll(s, 6);
    s = (r as Extract<typeof r, { ok: true }>).value.state;
    m = applyMove(s, 0);
    s = (m as Extract<typeof m, { ok: true }>).value.state;
    // Third six -> forfeit.
    r = applyRoll(s, 6);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.reason).toBe('TRIPLE_SIX');
      expect(r.value.turnPassed).toBe(true);
      expect(r.value.state.turnSeat).toBe(1);
    }
  });
});
