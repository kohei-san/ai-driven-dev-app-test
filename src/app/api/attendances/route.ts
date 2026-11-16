import { attendanceHandlers } from './_lib/attendanceContainer';

/** GET /api/attendances?from=YYYY-MM-DD&to=YYYY-MM-DD — 勤怠履歴一覧（F-04） */
export const GET = attendanceHandlers.getList;
