/**
 * Outbound port for pushing realtime updates to clients. The game service
 * depends on this, not on Socket.IO, so the orchestration logic is testable
 * with a fake gateway that just records emissions.
 */
export interface GameGateway {
  toRoom(matchId: string, event: string, data: unknown): void;
  toUser(userId: string, event: string, data: unknown): void;
}
