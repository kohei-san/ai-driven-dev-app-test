import { attendanceHandlers } from '../_lib/attendanceContainer';

/** GET /api/attendances/today — 当日の勤怠状況（F-03） */
export const GET = attendanceHandlers.getToday;
