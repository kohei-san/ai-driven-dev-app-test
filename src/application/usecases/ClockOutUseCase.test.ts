import { beforeEach, describe, expect, it } from 'vitest';
import { ClockOutUseCase } from './ClockOutUseCase';
import { AttendanceId } from '../../domain/models/attendance/AttendanceId';
import {
  InvalidBreakDurationError,
  InvalidClockOutTimeError,
  InvalidEmployeeIdError,
  NotClockedInError,
} from '../../domain/errors';
import { FakeAttendanceRepository } from '../../test-utils/FakeAttendanceRepository';
import { FixedClock } from '../../test-utils/FixedClock';
import { finishedAttendance, workingAttendance } from '../../test-utils/attendanceFixtures';
import { jst } from '../../test-utils/jst';

describe('ClockOutUseCase（退勤打刻 / F-02）', () => {
  let repository: FakeAttendanceRepository;
  let clock: FixedClock;
  let useCase: ClockOutUseCase;

  /** 09:00 に出勤済みの状態を作る */
  const givenWorkingSince = async (clockIn = '2026-11-16T09:00', id = 'att-1', employeeId = 'emp-001') => {
    await repository.save(workingAttendance({ id, employeeId, clockIn }));
  };

  const findSaved = (id: string) => repository.findById(AttendanceId.create(id));

  beforeEach(() => {
    repository = new FakeAttendanceRepository();
    clock = new FixedClock(jst('2026-11-16T18:00'));
    useCase = new ClockOutUseCase({ attendanceRepository: repository, clock });
  });

  describe('正常系', () => {
    it('AC-01-1: 現在時刻で退勤し、実働・残業を含む AttendanceDto を返す', async () => {
      await givenWorkingSince('2026-11-16T09:00');

      const dto = await useCase.execute({ employeeId: 'emp-001', breakMinutes: 60 });

      expect(dto).toEqual({
        id: 'att-1',
        employeeId: 'emp-001',
        businessDate: '2026-11-16',
        clockInAt: '2026-11-16T09:00:00+09:00',
        clockOutAt: '2026-11-16T18:00:00+09:00',
        breakMinutes: 60,
        workMinutes: 480,
        overtimeMinutes: 0,
        status: 'FINISHED',
      });
    });

    it('退勤済の勤怠をリポジトリに保存する（件数は増えない）', async () => {
      await givenWorkingSince();

      await useCase.execute({ employeeId: 'emp-001', breakMinutes: 60 });

      expect((await findSaved('att-1'))?.isWorking()).toBe(false);
      expect(repository.all()).toHaveLength(1);
    });

    it('AC-03-2: 20:30 退勤・休憩 60 分なら実働 630 分・残業 150 分', async () => {
      await givenWorkingSince('2026-11-16T09:00');
      clock.set(jst('2026-11-16T20:30'));

      const dto = await useCase.execute({ employeeId: 'emp-001', breakMinutes: 60 });

      expect(dto.workMinutes).toBe(630);
      expect(dto.overtimeMinutes).toBe(150);
    });

    it('AC-04-4: 休憩時間を省略すると 60 分として計算される', async () => {
      await givenWorkingSince('2026-11-16T09:00');

      const dto = await useCase.execute({ employeeId: 'emp-001' });

      expect(dto.breakMinutes).toBe(60);
      expect(dto.workMinutes).toBe(480);
    });

    it('休憩 0 分を指定できる', async () => {
      await givenWorkingSince('2026-11-16T09:00');
      clock.set(jst('2026-11-16T13:00'));

      const dto = await useCase.execute({ employeeId: 'emp-001', breakMinutes: 0 });

      expect(dto.breakMinutes).toBe(0);
      expect(dto.workMinutes).toBe(240);
    });

    it('AC-01-4: 日付をまたいで退勤でき、営業日は出勤日のまま', async () => {
      await givenWorkingSince('2026-11-15T22:00');
      clock.set(jst('2026-11-16T06:00'));

      const dto = await useCase.execute({ employeeId: 'emp-001', breakMinutes: 60 });

      expect(dto.businessDate).toBe('2026-11-15');
      expect(dto.clockOutAt).toBe('2026-11-16T06:00:00+09:00');
      expect(dto.workMinutes).toBe(420);
    });

    it('出勤中の勤怠が複数ある（前日の退勤忘れ）場合は、出勤時刻が最新のものを退勤する', async () => {
      await givenWorkingSince('2026-11-15T09:00', 'att-yesterday');
      await givenWorkingSince('2026-11-16T09:00', 'att-today');

      const dto = await useCase.execute({ employeeId: 'emp-001', breakMinutes: 60 });

      expect(dto.id).toBe('att-today');
      expect((await findSaved('att-yesterday'))?.isWorking()).toBe(true);
    });

    it('他の従業員の出勤中の勤怠には影響しない', async () => {
      await givenWorkingSince('2026-11-16T09:00', 'att-a', 'emp-001');
      await givenWorkingSince('2026-11-16T09:00', 'att-b', 'emp-002');

      await useCase.execute({ employeeId: 'emp-001', breakMinutes: 60 });

      expect((await findSaved('att-b'))?.isWorking()).toBe(true);
    });
  });

  describe('異常系', () => {
    it('AC-02-5: 出勤中の勤怠がなければ NotClockedInError', async () => {
      await expect(useCase.execute({ employeeId: 'emp-001', breakMinutes: 60 })).rejects.toThrow(NotClockedInError);
    });

    it('退勤済の勤怠しかなければ NotClockedInError（再退勤はできない）', async () => {
      await repository.save(
        finishedAttendance({ id: 'att-1', clockIn: '2026-11-16T09:00', clockOut: '2026-11-16T12:00' }),
      );

      await expect(useCase.execute({ employeeId: 'emp-001', breakMinutes: 0 })).rejects.toThrow(NotClockedInError);
    });

    it('他の従業員が出勤中でも、本人が未出勤なら NotClockedInError', async () => {
      await givenWorkingSince('2026-11-16T09:00', 'att-b', 'emp-002');

      await expect(useCase.execute({ employeeId: 'emp-001', breakMinutes: 60 })).rejects.toThrow(NotClockedInError);
    });

    it('AC-01-2: 出勤と同時刻の退勤は InvalidClockOutTimeError、勤怠は出勤中のまま', async () => {
      await givenWorkingSince('2026-11-16T09:00');
      clock.set(jst('2026-11-16T09:00'));

      await expect(useCase.execute({ employeeId: 'emp-001', breakMinutes: 0 })).rejects.toThrow(
        InvalidClockOutTimeError,
      );
      expect((await findSaved('att-1'))?.isWorking()).toBe(true);
    });

    it('AC-01-3: 出勤より前の時刻での退勤（時計の巻き戻り）は InvalidClockOutTimeError', async () => {
      await givenWorkingSince('2026-11-16T09:00');
      clock.set(jst('2026-11-16T08:59'));

      await expect(useCase.execute({ employeeId: 'emp-001', breakMinutes: 0 })).rejects.toThrow(
        InvalidClockOutTimeError,
      );
    });

    it.each([
      ['AC-04-1: 負の値', -1],
      ['AC-04-2: 小数', 30.5],
      ['NaN', Number.NaN],
    ])('%s の休憩時間は InvalidBreakDurationError、勤怠は出勤中のまま', async (_label, breakMinutes) => {
      await givenWorkingSince('2026-11-16T09:00');

      await expect(useCase.execute({ employeeId: 'emp-001', breakMinutes })).rejects.toThrow(InvalidBreakDurationError);
      expect((await findSaved('att-1'))?.isWorking()).toBe(true);
    });

    it('AC-04-3: 休憩が拘束時間以上（09:00〜10:00・休憩 60 分）は InvalidBreakDurationError', async () => {
      await givenWorkingSince('2026-11-16T09:00');
      clock.set(jst('2026-11-16T10:00'));

      await expect(useCase.execute({ employeeId: 'emp-001', breakMinutes: 60 })).rejects.toThrow(
        InvalidBreakDurationError,
      );
    });

    it('休憩時間の形式チェックは出勤中の勤怠の検索より先に行う', async () => {
      // 出勤中の勤怠がなくても、不正な休憩時間なら休憩時間のエラーを優先する
      await expect(useCase.execute({ employeeId: 'emp-001', breakMinutes: -1 })).rejects.toThrow(
        InvalidBreakDurationError,
      );
    });

    it('従業員IDが不正なら InvalidEmployeeIdError', async () => {
      await expect(useCase.execute({ employeeId: 'emp@001', breakMinutes: 60 })).rejects.toThrow(
        InvalidEmployeeIdError,
      );
    });
  });
});
