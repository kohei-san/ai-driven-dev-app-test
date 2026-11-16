import { InvalidClockTimeError } from '../../errors';
import { BusinessDate } from './BusinessDate';

/**
 * 出勤時刻（値オブジェクト）。
 * 可変な Date を直接保持せず、エポックミリ秒で保持して不変性を保証する。
 */
export class ClockInTime {
  private constructor(private readonly epochMs: number) {}

  static create(date: Date): ClockInTime {
    const epochMs = date.getTime();
    if (Number.isNaN(epochMs)) {
      throw new InvalidClockTimeError('出勤時刻が不正な日時です');
    }
    return new ClockInTime(epochMs);
  }

  /** 出勤時刻の JST 日付を営業日とする */
  toBusinessDate(): BusinessDate {
    return BusinessDate.fromInstant(this.toDate());
  }

  /** 呼び出しごとに新しい Date を返す（防御的コピー） */
  toDate(): Date {
    return new Date(this.epochMs);
  }
}
