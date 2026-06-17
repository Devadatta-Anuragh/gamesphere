/**
 * Time is an injected dependency, not a global. Domain code depends on this
 * port instead of calling `Date.now()` directly, which makes turn timers,
 * timestamps and grace periods fully deterministic in unit tests.
 */
export interface Clock {
  now(): Date;
  nowMs(): number;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
  nowMs(): number {
    return Date.now();
  }
}

/** Test double: time only advances when you tell it to. */
export class FixedClock implements Clock {
  constructor(private current: number = 0) {}
  now(): Date {
    return new Date(this.current);
  }
  nowMs(): number {
    return this.current;
  }
  advance(ms: number): void {
    this.current += ms;
  }
  set(ms: number): void {
    this.current = ms;
  }
}
