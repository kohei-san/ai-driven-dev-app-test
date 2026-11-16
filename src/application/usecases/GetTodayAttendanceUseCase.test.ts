import { beforeEach, describe, expect, it } from 'vitest';
import { GetTodayAttendanceUseCase } from './GetTodayAttendanceUseCase';
import { InvalidEmployeeIdError } from '../../domain/errors';
import { FakeAttendanceRepository } from '../../test-utils/FakeAttendanceRepository';
import { FixedClock } from '../../test-utils/FixedClock';
import { finishedAttendance, workingAttendance } from '../../test-utils/attendanceFixtures';
import { jst } from '../../test-utils/jst';

/**
 * GET /api/attendances/today（F-03）が依存するため、Issue #2 の範囲としてテストする。
 */
describe('GetTodayAttendanceUseCase（当日の勤怠状況 / F-03）', () => {
  let repository: FakeAttendanceRepository;
  let clock: FixedClock;
  let useCase: GetTodayAttendanceUseCase;

  beforeEach(() => {
    repository = new FakeAttendanceRepository();
    clock = new FixedClock(jst('2026-11-16T14:32'));
    useCase = new GetTodayAttendanceUseCase({ attendanceRepository: repository, clock });
  });

  it('本日の勤怠がなければ NOT_STARTED・attendance は null', async () => {
    expect(await useCase.execute({ employeeId: 'emp-001' })).toEqual({
      businessDate: '2026-11-16',
      status: 'NOT_STARTED',
      attendance: null,
    });
  });

  it('本日出勤中なら WORKING と、その勤怠を返す', async () => {
    await repository.save(workingAttendance({ id: 'att-1', clockIn: '2026-11-16T09:02' }));

    const result = await useCase.execute({ employeeId: 'emp-001' });

    expect(result.status).toBe('WORKING');
    expect(result.attendance).toMatchObject({ id: 'att-1', status: 'WORKING', clockInAt: '2026-11-16T09:02:00+09:00' });
  });

  it('本日退勤済なら FINISHED と、その勤怠を返す', async () => {
    await repository.save(finishedAttendance({ id: 'att-1', clockIn: '2026-11-16T09:00', clockOut: '2026-11-16T12:00' }));

    const result = await useCase.execute({ employeeId: 'emp-001' });

    expect(result.status).toBe('FINISHED');
    expect(result.attendance?.id).toBe('att-1');
  });

  it('退勤後に再出勤していれば、最新（再出勤分）の WORKING を返す', async () => {
    await repository.save(finishedAttendance({ id: 'att-am', clockIn: '2026-11-16T09:00', clockOut: '2026-11-16T12:00', breakMinutes: 0 }));
    await repository.save(workingAttendance({ id: 'att-pm', clockIn: '2026-11-16T13:00' }));

    const result = await useCase.execute({ employeeId: 'emp-001' });

    expect(result.status).toBe('WORKING');
    expect(result.attendance?.id).toBe('att-pm');
  });

  it('本日の勤怠がすべて退勤済なら、出勤時刻が最新のものを返す', async () => {
    await repository.save(finishedAttendance({ id: 'att-pm', clockIn: '2026-11-16T13:00', clockOut: '2026-11-16T14:00', breakMinutes: 0 }));
    await repository.save(finishedAttendance({ id: 'att-am', clockIn: '2026-11-16T09:00', clockOut: '2026-11-16T12:00', breakMinutes: 0 }));

    const result = await useCase.execute({ employeeId: 'emp-001' });

    expect(result.status).toBe('FINISHED');
    expect(result.attendance?.id).toBe('att-pm');
  });

  it('前日の退勤済の勤怠しかなければ NOT_STARTED', async () => {
    await repository.save(finishedAttendance({ id: 'att-1', clockIn: '2026-11-15T09:00', clockOut: '2026-11-15T18:00' }));

    expect((await useCase.execute({ employeeId: 'emp-001' })).status).toBe('NOT_STARTED');
  });

  it('日付またぎで前日から出勤中なら WORKING（画面から退勤できるようにするため）', async () => {
    await repository.save(workingAttendance({ id: 'att-night', clockIn: '2026-11-15T22:00' }));
    clock.set(jst('2026-11-16T02:00'));

    const result = await useCase.execute({ employeeId: 'emp-001' });

    expect(result.businessDate).toBe('2026-11-16');
    expect(result.status).toBe('WORKING');
    expect(result.attendance).toMatchObject({ id: 'att-night', businessDate: '2026-11-15' });
  });

  it('他の従業員の勤怠は参照しない', async () => {
    await repository.save(workingAttendance({ id: 'att-b', employeeId: 'emp-002', clockIn: '2026-11-16T09:00' }));

    expect((await useCase.execute({ employeeId: 'emp-001' })).status).toBe('NOT_STARTED');
  });

  it('従業員IDが不正なら InvalidEmployeeIdError', async () => {
    await expect(useCase.execute({ employeeId: 'emp@001' })).rejects.toThrow(InvalidEmployeeIdError);
  });
});
