import {
  AttendanceAlreadyFinishedError,
  InvalidAttendanceStateError,
  InvalidBreakDurationError,
  InvalidClockOutTimeError,
} from '../../errors';
import type { AttendanceId } from './AttendanceId';
import { AttendanceStatus } from './AttendanceStatus';
import type { BreakDuration } from './BreakDuration';
import type { BusinessDate } from './BusinessDate';
import type { ClockInTime } from './ClockInTime';
import type { ClockOutTime } from './ClockOutTime';
import type { EmployeeId } from './EmployeeId';
import type { OvertimeDuration } from './OvertimeDuration';
import { WorkDuration } from './WorkDuration';

const MS_PER_MINUTE = 60 * 1000;

export type AttendanceProps = {
  readonly id: AttendanceId;
  readonly employeeId: EmployeeId;
  readonly businessDate: BusinessDate;
  readonly clockInTime: ClockInTime;
  readonly clockOutTime: ClockOutTime | null;
  readonly breakDuration: BreakDuration | null;
};

export type ClockInParams = {
  readonly id: AttendanceId;
  readonly employeeId: EmployeeId;
  readonly clockInTime: ClockInTime;
};

/**
 * 勤怠（エンティティ / 集約ルート）。1 回の「出勤〜退勤」を表す。
 *
 * - 状態変更メソッドは自身を書き換えず、新しいインスタンスを返す（D-4）。
 * - ステータスはフィールドで持たず、退勤時刻の有無から導出する（状態と時刻の食い違いを作れない）。
 * - 実働・残業時間は保存せず、都度算出する。
 */
export class Attendance {
  private constructor(private readonly props: AttendanceProps) {}

  /** 出勤打刻: 出勤中の勤怠を生成する。営業日は出勤時刻の JST 日付 */
  static clockIn({ id, employeeId, clockInTime }: ClockInParams): Attendance {
    return new Attendance({
      id,
      employeeId,
      businessDate: clockInTime.toBusinessDate(),
      clockInTime,
      clockOutTime: null,
      breakDuration: null,
    });
  }

  /** 永続化データからの復元。不正データを取り込まないよう全不変条件を再検証する */
  static reconstruct(props: AttendanceProps): Attendance {
    if ((props.clockOutTime === null) !== (props.breakDuration === null)) {
      throw new InvalidAttendanceStateError('退勤時刻と休憩時間は両方とも未設定、または両方とも設定済みである必要があります');
    }
    if (!props.businessDate.equals(props.clockInTime.toBusinessDate())) {
      throw new InvalidAttendanceStateError('営業日が出勤時刻の日付と一致しません');
    }
    if (props.clockOutTime !== null && props.breakDuration !== null) {
      Attendance.assertValidClockOut(props.clockInTime, props.clockOutTime, props.breakDuration);
    }
    return new Attendance({ ...props });
  }

  /**
   * 退勤打刻: 退勤を記録した新しい勤怠を返す。
   * 検証順: ① 出勤中であること ② 退勤 > 出勤（BR-01） ③ 休憩 < 拘束時間（BR-04）
   */
  clockOut(clockOutTime: ClockOutTime, breakDuration: BreakDuration): Attendance {
    if (!this.isWorking()) {
      throw new AttendanceAlreadyFinishedError();
    }
    Attendance.assertValidClockOut(this.props.clockInTime, clockOutTime, breakDuration);
    return new Attendance({ ...this.props, clockOutTime, breakDuration });
  }

  private static assertValidClockOut(
    clockInTime: ClockInTime,
    clockOutTime: ClockOutTime,
    breakDuration: BreakDuration,
  ): void {
    if (!clockOutTime.isAfter(clockInTime)) {
      throw new InvalidClockOutTimeError();
    }
    // 拘束時間はミリ秒で比較する（分に丸めると「拘束 60分30秒・休憩 60 分」を誤って拒否してしまう）
    if (breakDuration.minutes * MS_PER_MINUTE >= clockOutTime.millisecondsSince(clockInTime)) {
      throw new InvalidBreakDurationError('休憩時間は拘束時間（出勤〜退勤）より短くしてください');
    }
  }

  get id(): AttendanceId {
    return this.props.id;
  }

  get employeeId(): EmployeeId {
    return this.props.employeeId;
  }

  get businessDate(): BusinessDate {
    return this.props.businessDate;
  }

  get clockInTime(): ClockInTime {
    return this.props.clockInTime;
  }

  get clockOutTime(): ClockOutTime | null {
    return this.props.clockOutTime;
  }

  get breakDuration(): BreakDuration | null {
    return this.props.breakDuration;
  }

  status(): AttendanceStatus {
    return this.props.clockOutTime === null ? AttendanceStatus.WORKING : AttendanceStatus.FINISHED;
  }

  isWorking(): boolean {
    return this.status() === AttendanceStatus.WORKING;
  }

  /** 実働時間（BR-03）。出勤中は null */
  workDuration(): WorkDuration | null {
    const { clockInTime, clockOutTime, breakDuration } = this.props;
    if (clockOutTime === null || breakDuration === null) {
      return null;
    }
    return WorkDuration.calculate(clockInTime, clockOutTime, breakDuration);
  }

  /** 残業時間（BR-03）。出勤中は null */
  overtimeDuration(): OvertimeDuration | null {
    return this.workDuration()?.overtime() ?? null;
  }

  /** エンティティの同一性は ID のみで判定する */
  equals(other: Attendance): boolean {
    return this.props.id.equals(other.props.id);
  }
}
