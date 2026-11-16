import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAttendanceRepository } from './InMemoryAttendanceRepository';
import type { IAttendanceRepository } from '../../domain/repositories/IAttendanceRepository';
import { Attendance } from '../../domain/models/attendance/Attendance';
import { AttendanceId } from '../../domain/models/attendance/AttendanceId';
import { AttendanceStatus } from '../../domain/models/attendance/AttendanceStatus';
import { BreakDuration } from '../../domain/models/attendance/BreakDuration';
import { BusinessDate } from '../../domain/models/attendance/BusinessDate';
import { ClockInTime } from '../../domain/models/attendance/ClockInTime';
import { ClockOutTime } from '../../domain/models/attendance/ClockOutTime';
import { EmployeeId } from '../../domain/models/attendance/EmployeeId';
import { AttendanceDuplicationChecker } from '../../domain/services/AttendanceDuplicationChecker';
import { AlreadyClockedInError } from '../../domain/errors';
import { jst } from '../../test-utils/jst';

// ---- テストデータ生成ヘルパー ----
const EMP_A = EmployeeId.create('emp-001');
const EMP_B = EmployeeId.create('emp-002');
const date = (value: string) => BusinessDate.create(value);

const working = (id: string, employeeId: EmployeeId, clockInLocal: string) =>
  Attendance.clockIn({
    id: AttendanceId.create(id),
    employeeId,
    clockInTime: ClockInTime.create(jst(clockInLocal)),
  });

const finished = (id: string, employeeId: EmployeeId, clockInLocal: string, clockOutLocal: string) =>
  working(id, employeeId, clockInLocal).clockOut(ClockOutTime.create(jst(clockOutLocal)), BreakDuration.create(0));

const ids = (attendances: Attendance[]) => attendances.map((a) => a.id.value);

async function saveAll(repository: IAttendanceRepository, attendances: Attendance[]): Promise<void> {
  for (const attendance of attendances) {
    await repository.save(attendance);
  }
}

describe('InMemoryAttendanceRepository', () => {
  let repository: InMemoryAttendanceRepository;

  beforeEach(() => {
    repository = new InMemoryAttendanceRepository();
  });

  it('IAttendanceRepository を実装している', () => {
    const asInterface: IAttendanceRepository = repository;
    expect(asInterface).toBeDefined();
  });

  describe('nextId', () => {
    it('AttendanceId を払い出す', () => {
      expect(repository.nextId()).toBeInstanceOf(AttendanceId);
    });

    it('呼び出すたびに一意な ID を返す', () => {
      const generated = Array.from({ length: 100 }, () => repository.nextId().value);
      expect(new Set(generated).size).toBe(100);
    });
  });

  describe('save / findById', () => {
    it('保存した勤怠を ID で取得できる', async () => {
      await repository.save(working('att-1', EMP_A, '2026-11-16T09:00'));

      const found = await repository.findById(AttendanceId.create('att-1'));

      expect(found?.id.value).toBe('att-1');
      expect(found?.employeeId.equals(EMP_A)).toBe(true);
      expect(found?.status()).toBe(AttendanceStatus.WORKING);
    });

    it('存在しない ID は null', async () => {
      expect(await repository.findById(AttendanceId.create('unknown'))).toBeNull();
    });

    it('同じ ID で保存すると上書きされる（upsert）', async () => {
      const w = working('att-1', EMP_A, '2026-11-16T09:00');
      await repository.save(w);
      await repository.save(w.clockOut(ClockOutTime.create(jst('2026-11-16T18:00')), BreakDuration.create(60)));

      const found = await repository.findById(AttendanceId.create('att-1'));
      expect(found?.status()).toBe(AttendanceStatus.FINISHED);
      expect(found?.workDuration()?.minutes).toBe(480);
      expect(await repository.findByEmployeeAndDate(EMP_A, date('2026-11-16'))).toHaveLength(1);
    });

    it('別インスタンスのリポジトリとはデータを共有しない', async () => {
      await repository.save(working('att-1', EMP_A, '2026-11-16T09:00'));
      const another = new InMemoryAttendanceRepository();
      expect(await another.findById(AttendanceId.create('att-1'))).toBeNull();
    });
  });

  describe('findWorkingByEmployeeAndDate（二重打刻チェック用）', () => {
    it('指定従業員・営業日の出勤中の勤怠を返す', async () => {
      await repository.save(working('att-1', EMP_A, '2026-11-16T09:00'));

      const found = await repository.findWorkingByEmployeeAndDate(EMP_A, date('2026-11-16'));

      expect(found?.id.value).toBe('att-1');
    });

    it('退勤済の勤怠は対象外（AC-02-3 の前提）', async () => {
      await repository.save(finished('att-1', EMP_A, '2026-11-16T09:00', '2026-11-16T12:00'));
      expect(await repository.findWorkingByEmployeeAndDate(EMP_A, date('2026-11-16'))).toBeNull();
    });

    it('他の従業員の出勤中の勤怠は対象外（AC-02-4 の前提）', async () => {
      await repository.save(working('att-1', EMP_B, '2026-11-16T09:00'));
      expect(await repository.findWorkingByEmployeeAndDate(EMP_A, date('2026-11-16'))).toBeNull();
    });

    it('別の営業日の出勤中の勤怠は対象外', async () => {
      await repository.save(working('att-1', EMP_A, '2026-11-15T09:00'));
      expect(await repository.findWorkingByEmployeeAndDate(EMP_A, date('2026-11-16'))).toBeNull();
    });

    it('同日に退勤済と出勤中がある場合は出勤中を返す', async () => {
      await saveAll(repository, [
        finished('att-1', EMP_A, '2026-11-16T09:00', '2026-11-16T12:00'),
        working('att-2', EMP_A, '2026-11-16T13:00'),
      ]);
      expect((await repository.findWorkingByEmployeeAndDate(EMP_A, date('2026-11-16')))?.id.value).toBe('att-2');
    });

    it('勤怠がなければ null', async () => {
      expect(await repository.findWorkingByEmployeeAndDate(EMP_A, date('2026-11-16'))).toBeNull();
    });
  });

  describe('findLatestWorkingByEmployee（退勤対象の検索用）', () => {
    it('営業日を問わず出勤中の勤怠を返す（日付またぎ退勤 / AC-01-4 の前提）', async () => {
      await repository.save(working('att-1', EMP_A, '2026-11-15T22:00'));
      expect((await repository.findLatestWorkingByEmployee(EMP_A))?.id.value).toBe('att-1');
    });

    it('出勤中が複数あれば出勤時刻が最新のものを返す', async () => {
      await saveAll(repository, [
        working('att-new', EMP_A, '2026-11-16T09:00'),
        working('att-old', EMP_A, '2026-11-15T09:00'),
      ]);
      expect((await repository.findLatestWorkingByEmployee(EMP_A))?.id.value).toBe('att-new');
    });

    it('退勤済の勤怠は対象外', async () => {
      await repository.save(finished('att-1', EMP_A, '2026-11-16T09:00', '2026-11-16T18:00'));
      expect(await repository.findLatestWorkingByEmployee(EMP_A)).toBeNull();
    });

    it('他の従業員の勤怠は対象外', async () => {
      await repository.save(working('att-1', EMP_B, '2026-11-16T09:00'));
      expect(await repository.findLatestWorkingByEmployee(EMP_A)).toBeNull();
    });

    it('勤怠がなければ null', async () => {
      expect(await repository.findLatestWorkingByEmployee(EMP_A)).toBeNull();
    });
  });

  describe('findByEmployeeAndDate（当日の状況確認用）', () => {
    it('指定営業日の勤怠を出勤時刻の昇順ですべて返す', async () => {
      await saveAll(repository, [
        working('att-pm', EMP_A, '2026-11-16T13:00'),
        finished('att-am', EMP_A, '2026-11-16T09:00', '2026-11-16T12:00'),
      ]);
      expect(ids(await repository.findByEmployeeAndDate(EMP_A, date('2026-11-16')))).toEqual(['att-am', 'att-pm']);
    });

    it('他の従業員・別の営業日の勤怠は含まない', async () => {
      await saveAll(repository, [
        working('att-target', EMP_A, '2026-11-16T09:00'),
        working('att-other-emp', EMP_B, '2026-11-16T09:00'),
        finished('att-other-day', EMP_A, '2026-11-15T09:00', '2026-11-15T18:00'),
      ]);
      expect(ids(await repository.findByEmployeeAndDate(EMP_A, date('2026-11-16')))).toEqual(['att-target']);
    });

    it('前日出勤・当日退勤の勤怠は前日の営業日に属する', async () => {
      await repository.save(finished('att-night', EMP_A, '2026-11-15T22:00', '2026-11-16T06:00'));
      expect(await repository.findByEmployeeAndDate(EMP_A, date('2026-11-16'))).toEqual([]);
      expect(ids(await repository.findByEmployeeAndDate(EMP_A, date('2026-11-15')))).toEqual(['att-night']);
    });

    it('勤怠がなければ空配列', async () => {
      expect(await repository.findByEmployeeAndDate(EMP_A, date('2026-11-16'))).toEqual([]);
    });
  });

  describe('findByEmployeeAndPeriod（履歴一覧用）', () => {
    beforeEach(async () => {
      await saveAll(repository, [
        finished('att-1031', EMP_A, '2026-10-31T09:00', '2026-10-31T18:00'), // 期間外（前）
        finished('att-1101', EMP_A, '2026-11-01T09:00', '2026-11-01T18:00'), // 期間開始日
        finished('att-1110-am', EMP_A, '2026-11-10T09:00', '2026-11-10T12:00'),
        finished('att-1110-pm', EMP_A, '2026-11-10T13:00', '2026-11-10T18:00'),
        working('att-1116', EMP_A, '2026-11-16T09:00'), // 期間終了日
        working('att-1117', EMP_A, '2026-11-17T09:00'), // 期間外（後）
        finished('att-emp-b', EMP_B, '2026-11-10T09:00', '2026-11-10T18:00'), // 他従業員
      ]);
    });

    it('期間の両端を含み、営業日の降順 → 出勤時刻の降順で返す', async () => {
      const result = await repository.findByEmployeeAndPeriod(EMP_A, date('2026-11-01'), date('2026-11-16'));
      expect(ids(result)).toEqual(['att-1116', 'att-1110-pm', 'att-1110-am', 'att-1101']);
    });

    it('出勤中・退勤済の両方を含む', async () => {
      const result = await repository.findByEmployeeAndPeriod(EMP_A, date('2026-11-01'), date('2026-11-16'));
      expect(result.map((a) => a.status())).toContain(AttendanceStatus.WORKING);
      expect(result.map((a) => a.status())).toContain(AttendanceStatus.FINISHED);
    });

    it('他の従業員の勤怠は含まない', async () => {
      const result = await repository.findByEmployeeAndPeriod(EMP_B, date('2026-11-01'), date('2026-11-16'));
      expect(ids(result)).toEqual(['att-emp-b']);
    });

    it('from と to が同じ日なら、その 1 日分を返す', async () => {
      const result = await repository.findByEmployeeAndPeriod(EMP_A, date('2026-11-10'), date('2026-11-10'));
      expect(ids(result)).toEqual(['att-1110-pm', 'att-1110-am']);
    });

    it('該当がなければ空配列', async () => {
      expect(await repository.findByEmployeeAndPeriod(EMP_A, date('2026-12-01'), date('2026-12-31'))).toEqual([]);
    });
  });

  describe('AttendanceDuplicationChecker との結合（BR-02）', () => {
    const TODAY = date('2026-11-16');
    let checker: AttendanceDuplicationChecker;

    beforeEach(() => {
      checker = new AttendanceDuplicationChecker(repository);
    });

    it('AC-02-1: 勤怠がなければ出勤できる', async () => {
      await expect(checker.ensureCanClockIn(EMP_A, TODAY)).resolves.toBeUndefined();
    });

    it('AC-02-2: 同一営業日に出勤中なら AlreadyClockedInError', async () => {
      await repository.save(working('att-1', EMP_A, '2026-11-16T09:00'));
      await expect(checker.ensureCanClockIn(EMP_A, TODAY)).rejects.toThrow(AlreadyClockedInError);
    });

    it('AC-02-3: 同一営業日でも退勤済なら再出勤できる', async () => {
      await repository.save(finished('att-1', EMP_A, '2026-11-16T09:00', '2026-11-16T12:00'));
      await expect(checker.ensureCanClockIn(EMP_A, TODAY)).resolves.toBeUndefined();
    });

    it('AC-02-4: 他の従業員が出勤中でも出勤できる', async () => {
      await repository.save(working('att-1', EMP_B, '2026-11-16T09:00'));
      await expect(checker.ensureCanClockIn(EMP_A, TODAY)).resolves.toBeUndefined();
    });
  });
});
