/**
 * 勤怠ステータス。
 * 「未出勤」は勤怠レコードが存在しない状態のため、ここには含めない。
 */
export const AttendanceStatus = Object.freeze({
  WORKING: 'WORKING',
  FINISHED: 'FINISHED',
} as const);

export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];
