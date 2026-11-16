import type { Attendance } from '../../domain/models/attendance/Attendance';
import { AttendanceId } from '../../domain/models/attendance/AttendanceId';
import type { BusinessDate } from '../../domain/models/attendance/BusinessDate';
import type { EmployeeId } from '../../domain/models/attendance/EmployeeId';
import type { IAttendanceRepository } from '../../domain/repositories/IAttendanceRepository';

const clockInMs = (attendance: Attendance) => attendance.clockInTime.toDate().getTime();

/** 出勤時刻の昇順 */
const byClockInAsc = (a: Attendance, b: Attendance) => clockInMs(a) - clockInMs(b);

/** 出勤時刻の降順 */
const byClockInDesc = (a: Attendance, b: Attendance) => clockInMs(b) - clockInMs(a);

/** 営業日の降順 → 同日内は出勤時刻の降順 */
const byBusinessDateDescThenClockInDesc = (a: Attendance, b: Attendance) =>
  a.businessDate.daysUntil(b.businessDate) || byClockInDesc(a, b);

/**
 * 勤怠リポジトリのインメモリ実装（MVP 用）。
 * Attendance は不変オブジェクトのため、保存したインスタンスをそのまま保持しても外部から書き換えられることはない。
 * データはプロセス内のこのインスタンスにのみ存在し、再起動で消える。
 */
export class InMemoryAttendanceRepository implements IAttendanceRepository {
  private readonly store = new Map<string, Attendance>();

  nextId(): AttendanceId {
    return AttendanceId.create(crypto.randomUUID());
  }

  async save(attendance: Attendance): Promise<void> {
    this.store.set(attendance.id.value, attendance);
  }

  async findById(id: AttendanceId): Promise<Attendance | null> {
    return this.store.get(id.value) ?? null;
  }

  async findWorkingByEmployeeAndDate(employeeId: EmployeeId, businessDate: BusinessDate): Promise<Attendance | null> {
    const [latest] = this.ofEmployee(employeeId)
      .filter((a) => a.isWorking() && a.businessDate.equals(businessDate))
      .sort(byClockInDesc);
    return latest ?? null;
  }

  async findLatestWorkingByEmployee(employeeId: EmployeeId): Promise<Attendance | null> {
    const [latest] = this.ofEmployee(employeeId)
      .filter((a) => a.isWorking())
      .sort(byClockInDesc);
    return latest ?? null;
  }

  async findByEmployeeAndDate(employeeId: EmployeeId, businessDate: BusinessDate): Promise<Attendance[]> {
    return this.ofEmployee(employeeId)
      .filter((a) => a.businessDate.equals(businessDate))
      .sort(byClockInAsc);
  }

  async findByEmployeeAndPeriod(employeeId: EmployeeId, from: BusinessDate, to: BusinessDate): Promise<Attendance[]> {
    return this.ofEmployee(employeeId)
      .filter((a) => !from.isAfter(a.businessDate) && !a.businessDate.isAfter(to))
      .sort(byBusinessDateDescThenClockInDesc);
  }

  private ofEmployee(employeeId: EmployeeId): Attendance[] {
    return [...this.store.values()].filter((a) => a.employeeId.equals(employeeId));
  }
}
