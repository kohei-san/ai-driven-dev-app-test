import { InvalidBreakDurationError, InvalidClockOutTimeError } from '../../errors';
import type { BreakDuration } from './BreakDuration';
import type { ClockInTime } from './ClockInTime';
import type { ClockOutTime } from './ClockOutTime';
import { OvertimeDuration } from './OvertimeDuration';

export { STANDARD_WORK_MINUTES } from './StandardWorkTime';

/** 実働時間（値オブジェクト / 分単位）。保存せず、退勤時刻と休憩時間から都度算出する。 */
export class WorkDuration {
  private constructor(readonly minutes: number) {}

  /** 実働 =（退勤 − 出勤 ※秒以下切り捨て）− 休憩（BR-03） */
  static calculate(clockIn: ClockInTime, clockOut: ClockOutTime, breakDuration: BreakDuration): WorkDuration {
    if (!clockOut.isAfter(clockIn)) {
      throw new InvalidClockOutTimeError();
    }
    const minutes = clockOut.minutesSince(clockIn) - breakDuration.minutes;
    if (minutes < 0) {
      throw new InvalidBreakDurationError('休憩時間が拘束時間を超えています');
    }
    return new WorkDuration(minutes);
  }

  overtime(): OvertimeDuration {
    return OvertimeDuration.fromWork(this);
  }
}
