import { describe, expect, it, vi } from 'vitest';
import { AttendanceDuplicationChecker } from './AttendanceDuplicationChecker';
import type { IAttendanceRepository } from '../repositories/IAttendanceRepository';
import { Attendance } from '../models/attendance/Attendance';
import { AttendanceId } from '../models/attendance/AttendanceId';
import { BusinessDate } from '../models/attendance/BusinessDate';
import { ClockInTime } from '../models/attendance/ClockInTime';
import { EmployeeId } from '../models/attendance/EmployeeId';
import { AlreadyClockedInError } from '../errors';
import { jst } from '../../test-utils/jst';

/**
 * domain 層のテストは infrastructure 層を import できない（arch:check の domain-no-outer-layers）。
 * そのため、ここではリポジトリをスタブで差し替え、「ドメインサービスがリポジトリの結果をどう判定するか」だけを検証する。
 * 「出勤中のみを抽出する」「従業員・営業日で絞り込む」といった検索条件の正しさは
 * InMemoryAttendanceRepository.test.ts で検証する。
 */
function createRepositoryStub(overrides: Partial<IAttendanceRepository> = {}): IAttendanceRepository {
  const unused = (name: string) => () => {
    throw new Error(`${name} はこのテストでは呼ばれない想定です`);
  };
  return {
    nextId: unused('nextId'),
    save: unused('save'),
    findById: unused('findById'),
    findWorkingByEmployeeAndDate: unused('findWorkingByEmployeeAndDate'),
    findLatestWorkingByEmployee: unused('findLatestWorkingByEmployee'),
    findByEmployeeAndDate: unused('findByEmployeeAndDate'),
    findByEmployeeAndPeriod: unused('findByEmployeeAndPeriod'),
    ...overrides,
  };
}

const EMP = EmployeeId.create('emp-001');
const TODAY = BusinessDate.create('2026-11-16');
const workingToday = () =>
  Attendance.clockIn({
    id: AttendanceId.create('att-1'),
    employeeId: EMP,
    clockInTime: ClockInTime.create(jst('2026-11-16T09:00')),
  });

describe('AttendanceDuplicationChecker（二重打刻の防止 / BR-02）', () => {
  it('AC-02-1: 同一営業日に出勤中の勤怠がなければ出勤できる（例外なし）', async () => {
    const repository = createRepositoryStub({
      findWorkingByEmployeeAndDate: vi.fn<IAttendanceRepository['findWorkingByEmployeeAndDate']>().mockResolvedValue(null),
    });
    const checker = new AttendanceDuplicationChecker(repository);

    await expect(checker.ensureCanClockIn(EMP, TODAY)).resolves.toBeUndefined();
  });

  it('AC-02-2: 同一営業日に出勤中の勤怠があれば AlreadyClockedInError', async () => {
    const repository = createRepositoryStub({
      findWorkingByEmployeeAndDate: vi
        .fn<IAttendanceRepository['findWorkingByEmployeeAndDate']>()
        .mockResolvedValue(workingToday()),
    });
    const checker = new AttendanceDuplicationChecker(repository);

    await expect(checker.ensureCanClockIn(EMP, TODAY)).rejects.toThrow(AlreadyClockedInError);
  });

  it('リポジトリに従業員IDと営業日をそのまま渡して問い合わせる', async () => {
    const findWorking = vi.fn<IAttendanceRepository['findWorkingByEmployeeAndDate']>().mockResolvedValue(null);
    const checker = new AttendanceDuplicationChecker(createRepositoryStub({ findWorkingByEmployeeAndDate: findWorking }));

    await checker.ensureCanClockIn(EMP, TODAY);

    expect(findWorking).toHaveBeenCalledTimes(1);
    const [employeeId, businessDate] = findWorking.mock.calls[0];
    expect(employeeId.equals(EMP)).toBe(true);
    expect(businessDate.equals(TODAY)).toBe(true);
  });

  it('リポジトリの例外はそのまま伝播する', async () => {
    const repository = createRepositoryStub({
      findWorkingByEmployeeAndDate: vi
        .fn<IAttendanceRepository['findWorkingByEmployeeAndDate']>()
        .mockRejectedValue(new Error('storage failure')),
    });
    const checker = new AttendanceDuplicationChecker(repository);

    await expect(checker.ensureCanClockIn(EMP, TODAY)).rejects.toThrow('storage failure');
  });
});
