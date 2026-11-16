import type {
  AttendanceDto,
  AttendanceListDto,
  TodayAttendanceDto,
} from '../application/dto/AttendanceDto';

/** テストデータ: 出勤中の AttendanceDto（API レスポンス相当） */
export function workingAttendanceDto(overrides: Partial<AttendanceDto> = {}): AttendanceDto {
  return {
    id: 'att-working',
    employeeId: 'emp-001',
    businessDate: '2026-11-16',
    clockInAt: '2026-11-16T09:02:00+09:00',
    clockOutAt: null,
    breakMinutes: null,
    workMinutes: null,
    overtimeMinutes: null,
    status: 'WORKING',
    ...overrides,
  };
}

/** テストデータ: 退勤済の AttendanceDto（09:00〜20:30、休憩 60 分 → 実働 630 / 残業 150） */
export function finishedAttendanceDto(overrides: Partial<AttendanceDto> = {}): AttendanceDto {
  return {
    id: 'att-finished',
    employeeId: 'emp-001',
    businessDate: '2026-11-13',
    clockInAt: '2026-11-13T09:00:00+09:00',
    clockOutAt: '2026-11-13T20:30:00+09:00',
    breakMinutes: 60,
    workMinutes: 630,
    overtimeMinutes: 150,
    status: 'FINISHED',
    ...overrides,
  };
}

export function todayDto(overrides: Partial<TodayAttendanceDto> = {}): TodayAttendanceDto {
  return {
    businessDate: '2026-11-16',
    status: 'NOT_STARTED',
    attendance: null,
    ...overrides,
  };
}

export function attendanceListDto(overrides: Partial<AttendanceListDto> = {}): AttendanceListDto {
  return {
    from: '2026-11-01',
    to: '2026-11-16',
    items: [],
    totalWorkMinutes: 0,
    totalOvertimeMinutes: 0,
    ...overrides,
  };
}
