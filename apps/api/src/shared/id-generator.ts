import { nanoid } from 'nanoid';

/**
 * Id generation behind a port so domain/use-case code stays deterministic in
 * tests (inject a sequence generator) and free of the concrete id library.
 */
export interface IdGenerator {
  generate(): string;
}

export class NanoidGenerator implements IdGenerator {
  constructor(private readonly size = 21) {}
  generate(): string {
    return nanoid(this.size);
  }
}

/** Test double producing predictable ids: id-1, id-2, ... */
export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;
  constructor(private readonly prefix = 'id') {}
  generate(): string {
    this.counter += 1;
    return `${this.prefix}-${this.counter}`;
  }
}
