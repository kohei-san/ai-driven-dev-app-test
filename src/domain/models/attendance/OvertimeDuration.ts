import { STANDARD_WORK_MINUTES } from './StandardWorkTime';

/**
 * 実働時間を表す最小限の構造。
 * WorkDuration を直接 import すると WorkDuration ⇄ OvertimeDuration の循環参照になるため、構造的型で受け取る。
 */
type WorkMinutes = { readonly minutes: number };

/** 残業時間（値オブジェクト / 分単位）。所定労働時間を超えた実働分。 */
export class OvertimeDuration {
  private constructor(readonly minutes: number) {}

  /** 残業 = max(0, 実働 − 所定労働時間 480 分)（BR-03） */
  static fromWork(work: WorkMinutes): OvertimeDuration {
    return new OvertimeDuration(Math.max(0, work.minutes - STANDARD_WORK_MINUTES));
  }
}
