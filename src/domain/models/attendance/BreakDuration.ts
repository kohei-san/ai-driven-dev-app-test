import { InvalidBreakDurationError } from '../../errors';

const DEFAULT_BREAK_MINUTES = 60;

/**
 * 休憩時間（値オブジェクト / 分単位）。
 * ここでは形式（0 以上の整数）だけを検証する。
 * 「拘束時間未満」は出勤・退勤時刻が揃う Attendance.clockOut() が検証する（BR-04）。
 */
export class BreakDuration {
  private constructor(readonly minutes: number) {}

  static create(minutes: number): BreakDuration {
    // Number.isInteger は NaN・Infinity・小数をすべて false にする
    if (!Number.isInteger(minutes) || minutes < 0) {
      throw new InvalidBreakDurationError(`休憩時間は0以上の整数（分）で指定してください: ${minutes}`);
    }
    return new BreakDuration(minutes);
  }

  /** 休憩時間が省略された場合の既定値（60 分） */
  static default(): BreakDuration {
    return new BreakDuration(DEFAULT_BREAK_MINUTES);
  }
}
