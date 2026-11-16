import type { IClock } from '../application/ports/IClock';

/**
 * テスト専用の時計。`now()` は `set()` で指定した時刻を返す。
 * 「09:00 に出勤 → 18:00 に退勤」のような時刻依存のシナリオを決定的に再現するために使う。
 */
export class FixedClock implements IClock {
  private current: Date;

  constructor(initial: Date) {
    this.current = new Date(initial.getTime());
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  set(date: Date): void {
    this.current = new Date(date.getTime());
  }
}
