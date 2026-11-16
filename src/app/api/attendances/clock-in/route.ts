import { attendanceHandlers } from '../_lib/attendanceContainer';

/** POST /api/attendances/clock-in — 出勤打刻（F-01） */
export const POST = attendanceHandlers.clockIn;
