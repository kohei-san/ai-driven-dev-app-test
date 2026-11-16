/**
 * ユースケースの入出力 DTO。
 * プリミティブ型のみで構成し、ドメインオブジェクトを application 層の外へ漏らさない。
 * 日時は JST オフセット付き ISO 8601 文字列（例: "2026-11-14T09:00:00+09:00"）、日付は "YYYY-MM-DD"。
 */

// ---- 入力 ----
export type ClockInInput = {
  readonly employeeId: string;
};

export type ClockOutInput = {
  readonly employeeId: string;
  /** 省略時は既定の 60 分 */
  readonly breakMinutes?: number;
};

export type GetAttendanceListInput = {
  readonly employeeId: string;
  /** 省略時は `to` の月（`to` も省略なら当月）の 1 日 */
  readonly from?: string;
  /** 省略時は本日 */
  readonly to?: string;
};

export type GetTodayAttendanceInput = {
  readonly employeeId: string;
};

// ---- 出力 ----
export type AttendanceStatusDto = 'WORKING' | 'FINISHED';

export type AttendanceDto = {
  id: string;
  employeeId: string;
  businessDate: string;
  clockInAt: string;
  clockOutAt: string | null;
  breakMinutes: number | null;
  workMinutes: number | null;
  overtimeMinutes: number | null;
  status: AttendanceStatusDto;
};

export type TodayAttendanceStatusDto = 'NOT_STARTED' | AttendanceStatusDto;

export type TodayAttendanceDto = {
  businessDate: string;
  status: TodayAttendanceStatusDto;
  /** 当日の最新の勤怠（日付またぎで出勤中なら前日分）。未出勤なら null */
  attendance: AttendanceDto | null;
};

export type AttendanceListDto = {
  from: string;
  to: string;
  /** 営業日の降順 → 出勤時刻の降順 */
  items: AttendanceDto[];
  /** 退勤済の勤怠のみ集計 */
  totalWorkMinutes: number;
  totalOvertimeMinutes: number;
};
