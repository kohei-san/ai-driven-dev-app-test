import { beforeEach, describe, expect, it } from 'vitest';
import { ClockInUseCase } from './ClockInUseCase';
import { AttendanceDuplicationChecker } from '../../domain/services/AttendanceDuplicationChecker';
import { AttendanceId } from '../../domain/models/attendance/AttendanceId';
import { AlreadyClockedInError, InvalidClockTimeError, InvalidEmployeeIdError } from '../../domain/errors';
import { FakeAttendanceRepository } from '../../test-utils/FakeAttendanceRepository';
import { FixedClock } from '../../test-utils/FixedClock';
import { finishedAttendance, workingAttendance } from '../../test-utils/attendanceFixtures';
import { jst } from '../../test-utils/jst';

describe('ClockInUseCase（出勤打刻 / F-01）', () => {
  let repository: FakeAttendanceRepository;
  let clock: FixedClock;
  let useCase: ClockInUseCase;

  beforeEach(() => {
    repository = new FakeAttendanceRepository();
    clock = new FixedClock(jst('2026-11-16T09:02'));
    useCase = new ClockInUseCase({
      attendanceRepository: repository,
      duplicationChecker: new AttendanceDuplicationChecker(repository),
      clock,
    });
  });

  describe('正常系', () => {
    it('AC-02-1: 現在時刻で出勤中の勤怠を作成し、AttendanceDto を返す', async () => {
      const dto = await useCase.execute({ employeeId: 'emp-001' });

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

    it('作成した勤怠をリポジトリに保存する', async () => {
      const dto = await useCase.execute({ employeeId: 'emp-001' });

      const saved = await repository.findById(AttendanceId.create(dto.id));
      expect(saved?.isWorking()).toBe(true);
      expect(repository.all()).toHaveLength(1);
    });

    it('勤怠IDはリポジトリの nextId() で払い出す', async () => {
      const first = await useCase.execute({ employeeId: 'emp-001' });
      const second = await useCase.execute({ employeeId: 'emp-002' });

      expect(first.id).toBe('att-1');
      expect(second.id).toBe('att-2');
    });

    it('従業員IDの前後の空白は除去される', async () => {
      const dto = await useCase.execute({ employeeId: '  emp-001  ' });
      expect(dto.employeeId).toBe('emp-001');
    });

    it('営業日は出勤時刻の JST 日付になる（JST 00:30 は当日）', async () => {
      clock.set(new Date('2026-11-15T15:30:00Z')); // = 2026-11-16 00:30 JST
      const dto = await useCase.execute({ employeeId: 'emp-001' });
      expect(dto.businessDate).toBe('2026-11-16');
    });

    it('AC-02-3: 同一営業日でも退勤済なら再出勤でき、同日 2 件目の勤怠が作成される', async () => {
      await repository.save(
        finishedAttendance({ id: 'att-am', clockIn: '2026-11-16T09:00', clockOut: '2026-11-16T12:00', breakMinutes: 0 }),
      );
      clock.set(jst('2026-11-16T13:00'));

      const dto = await useCase.execute({ employeeId: 'emp-001' });

      expect(dto.status).toBe('WORKING');
      expect(dto.clockInAt).toBe('2026-11-16T13:00:00+09:00');
      expect(repository.all()).toHaveLength(2);
    });

    it('AC-02-4: 他の従業員が出勤中でも出勤できる', async () => {
      await repository.save(workingAttendance({ id: 'att-b', employeeId: 'emp-002', clockIn: '2026-11-16T08:30' }));

      const dto = await useCase.execute({ employeeId: 'emp-001' });

      expect(dto.employeeId).toBe('emp-001');
      expect(repository.all()).toHaveLength(2);
    });

    it('前日の勤怠が出勤中のまま（退勤忘れ）でも、別営業日なので出勤できる', async () => {
      await repository.save(workingAttendance({ id: 'att-yesterday', clockIn: '2026-11-15T09:00' }));

      const dto = await useCase.execute({ employeeId: 'emp-001' });

      expect(dto.businessDate).toBe('2026-11-16');
    });
  });

  describe('異常系', () => {
    it('AC-02-2: 同一営業日に出勤中の勤怠があれば AlreadyClockedInError、レコードは増えない', async () => {
      await useCase.execute({ employeeId: 'emp-001' });
      clock.set(jst('2026-11-16T09:30'));

      await expect(useCase.execute({ employeeId: 'emp-001' })).rejects.toThrow(AlreadyClockedInError);
      expect(repository.all()).toHaveLength(1);
    });

    it.each([
      ['空文字', ''],
      ['空白のみ', '   '],
      ['使用できない記号', 'emp@001'],
      ['65 文字', 'a'.repeat(65)],
    ])('従業員IDが不正（%s）なら InvalidEmployeeIdError、何も保存しない', async (_label, employeeId) => {
      await expect(useCase.execute({ employeeId })).rejects.toThrow(InvalidEmployeeIdError);
      expect(repository.all()).toHaveLength(0);
    });

    it('時計が不正な日時を返した場合は InvalidClockTimeError、何も保存しない', async () => {
      clock.set(new Date(Number.NaN));

      await expect(useCase.execute({ employeeId: 'emp-001' })).rejects.toThrow(InvalidClockTimeError);
      expect(repository.all()).toHaveLength(0);
    });
  });
});
