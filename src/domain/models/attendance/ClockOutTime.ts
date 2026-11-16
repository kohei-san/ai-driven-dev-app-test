import { InvalidClockTimeError } from '../../errors';
import type { ClockInTime } from './ClockInTime';

const MS_PER_MINUTE = 60 * 1000;

/**
 * 退勤時刻（値オブジェクト）。
 * 「出勤時刻より後」というルール（BR-01）は比較相手が揃う Attendance.clockOut() が守る。
 * このクラスは比較・経過時間の計算手段だけを提供する。
 */
export class ClockOutTime {
  private constructor(private readonly epochMs: number) {}

  static create(date: Date): ClockOutTime {
    const epochMs = date.getTime();
    if (Number.isNaN(epochMs)) {
      throw new InvalidClockTimeError('退勤時刻が不正な日時です');
    }
    return new ClockOutTime(epochMs);
  }

  isAfter(clockIn: ClockInTime): boolean {
    return this.millisecondsSince(clockIn) > 0;
  }

  /** 出勤からの経過ミリ秒（拘束時間） */
  millisecondsSince(clockIn: ClockInTime): number {
    return this.epochMs - clockIn.toDate().getTime();
  }

  /** 出勤からの経過分。秒以下は切り捨てる */
  minutesSince(clockIn: ClockInTime): number {
    return Math.floor(this.millisecondsSince(clockIn) / MS_PER_MINUTE);
  }

  /** 呼び出しごとに新しい Date を返す（防御的コピー） */
  toDate(): Date {
    return new Date(this.epochMs);
  }
}
