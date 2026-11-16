import { attendanceHandlers } from '../_lib/attendanceContainer';

/** POST /api/attendances/clock-out — 退勤打刻（F-02）。ボディ: `{ "breakMinutes"?: number }` */
export const POST = attendanceHandlers.clockOut;
