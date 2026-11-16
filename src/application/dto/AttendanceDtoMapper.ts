import type { Attendance } from '../../domain/models/attendance/Attendance';
import type { AttendanceDto } from './AttendanceDto';

/** 日本標準時（UTC+9）。夏時間がないため固定オフセットで扱える。 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 時点を JST オフセット付き ISO 8601 文字列（秒まで・ミリ秒は切り捨て）に変換する。
 * 実行環境のタイムゾーンに依存しないよう、+9h ずらした UTC 表記を使う。
 */
function toJstIsoString(instant: Date): string {
  const shifted = new Date(instant.getTime() + JST_OFFSET_MS);
  // toISOString() = "YYYY-MM-DDTHH:mm:ss.sssZ" → 先頭 19 文字が秒まで
  return `${shifted.toISOString().slice(0, 19)}+09:00`;
}

/** エンティティ → DTO の変換を一箇所に集約する */
export const AttendanceDtoMapper = {
  toDto(attendance: Attendance): AttendanceDto {
    const clockOutTime = attendance.clockOutTime;
    const workDuration = attendance.workDuration();

    return {
      id: attendance.id.value,
      employeeId: attendance.employeeId.value,
      businessDate: attendance.businessDate.value,
      clockInAt: toJstIsoString(attendance.clockInTime.toDate()),
      clockOutAt: clockOutTime === null ? null : toJstIsoString(clockOutTime.toDate()),
      breakMinutes: attendance.breakDuration?.minutes ?? null,
      workMinutes: workDuration?.minutes ?? null,
      overtimeMinutes: workDuration?.overtime().minutes ?? null,
      status: attendance.status(),
    };
  },
} as const;
