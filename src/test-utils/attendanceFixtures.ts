import { Attendance } from '../domain/models/attendance/Attendance';
import { AttendanceId } from '../domain/models/attendance/AttendanceId';
import { BreakDuration } from '../domain/models/attendance/BreakDuration';
import { ClockInTime } from '../domain/models/attendance/ClockInTime';
import { ClockOutTime } from '../domain/models/attendance/ClockOutTime';
import { EmployeeId } from '../domain/models/attendance/EmployeeId';
import { jst } from './jst';

type WorkingParams = {
  id: string;
  /** 省略時 `emp-001` */
  employeeId?: string;
  /** JST ローカル日時（例: `2026-11-16T09:00`） */
  clockIn: string;
};

type FinishedParams = WorkingParams & {
  clockOut: string;
  /** 省略時 60 分 */
  breakMinutes?: number;
};

/** テストデータ: 出勤中の勤怠 */
export function workingAttendance({ id, employeeId = 'emp-001', clockIn }: WorkingParams): Attendance {
  return Attendance.clockIn({
    id: AttendanceId.create(id),
    employeeId: EmployeeId.create(employeeId),
    clockInTime: ClockInTime.create(jst(clockIn)),
  });
}

/** テストデータ: 退勤済の勤怠 */
export function finishedAttendance({ clockOut, breakMinutes = 60, ...rest }: FinishedParams): Attendance {
  return workingAttendance(rest).clockOut(ClockOutTime.create(jst(clockOut)), BreakDuration.create(breakMinutes));
}
