import { describe, expect, it } from 'vitest';
import { AttendanceDtoMapper } from './AttendanceDtoMapper';
import { Attendance } from '../../domain/models/attendance/Attendance';
import { AttendanceId } from '../../domain/models/attendance/AttendanceId';
import { ClockInTime } from '../../domain/models/attendance/ClockInTime';
import { EmployeeId } from '../../domain/models/attendance/EmployeeId';
import { finishedAttendance, workingAttendance } from '../../test-utils/attendanceFixtures';

describe('AttendanceDtoMapper.toDto', () => {
  it('出勤中の勤怠: 退勤・休憩・実働・残業は null', () => {
    const dto = AttendanceDtoMapper.toDto(workingAttendance({ id: 'att-1', clockIn: '2026-11-16T09:02' }));

    expect(dto).toEqual({
      id: 'att-1',
      employeeId: 'emp-001',
      businessDate: '2026-11-16',
      clockInAt: '2026-11-16T09:02:00+09:00',
      clockOutAt: null,
      breakMinutes: null,
      workMinutes: null,
      overtimeMinutes: null,
      status: 'WORKING',
    });
  });

  it('退勤済の勤怠: 実働・残業が算出される（AC-03-2）', () => {
    const dto = AttendanceDtoMapper.toDto(
      finishedAttendance({ id: 'att-1', clockIn: '2026-11-14T09:00', clockOut: '2026-11-14T20:30', breakMinutes: 60 }),
    );

    expect(dto).toEqual({
      id: 'att-1',
      employeeId: 'emp-001',
      businessDate: '2026-11-14',
      clockInAt: '2026-11-14T09:00:00+09:00',
      clockOutAt: '2026-11-14T20:30:00+09:00',
      breakMinutes: 60,
      workMinutes: 630,
      overtimeMinutes: 150,
      status: 'FINISHED',
    });
  });

  it('日付またぎ: 営業日は出勤日、退勤時刻は翌日の JST で表現される', () => {
    const dto = AttendanceDtoMapper.toDto(
      finishedAttendance({ id: 'att-1', clockIn: '2026-11-15T22:00', clockOut: '2026-11-16T06:00', breakMinutes: 60 }),
    );

    expect(dto.businessDate).toBe('2026-11-15');
    expect(dto.clockInAt).toBe('2026-11-15T22:00:00+09:00');
    expect(dto.clockOutAt).toBe('2026-11-16T06:00:00+09:00');
    expect(dto.workMinutes).toBe(420);
  });

  it('時刻は秒まで表し、ミリ秒は切り捨てる', () => {
    const dto = AttendanceDtoMapper.toDto(
      finishedAttendance({ id: 'att-1', clockIn: '2026-11-16T09:00:05.999', clockOut: '2026-11-16T18:00:59.500' }),
    );

    expect(dto.clockInAt).toBe('2026-11-16T09:00:05+09:00');
    expect(dto.clockOutAt).toBe('2026-11-16T18:00:59+09:00');
  });

  it('JST の 0 時台は前日の UTC だが、JST の日付・時刻で表現される', () => {
    const attendance = Attendance.clockIn({
      id: AttendanceId.create('att-1'),
      employeeId: EmployeeId.create('emp-001'),
      clockInTime: ClockInTime.create(new Date('2026-11-15T15:05:00Z')),
    });

    const dto = AttendanceDtoMapper.toDto(attendance);

    expect(dto.businessDate).toBe('2026-11-16');
    expect(dto.clockInAt).toBe('2026-11-16T00:05:00+09:00');
  });
});
