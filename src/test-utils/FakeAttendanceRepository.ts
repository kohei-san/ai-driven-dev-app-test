import type { Attendance } from '../domain/models/attendance/Attendance';
import { AttendanceId } from '../domain/models/attendance/AttendanceId';
import type { BusinessDate } from '../domain/models/attendance/BusinessDate';
import type { EmployeeId } from '../domain/models/attendance/EmployeeId';
import type { IAttendanceRepository } from '../domain/repositories/IAttendanceRepository';

/**
 * application 層のテスト用フェイクリポジトリ。
 *
 * application 層のテストは arch:check（application-no-outer-layers）により infrastructure 層の
 * InMemoryAttendanceRepository を import できないため、domain 層のみに依存するフェイクを用意する。
 * - `nextId()` は `att-1`, `att-2`, ... を順に払い出す（DTO の期待値を固定できる）
 * - `all()` で保存内容を検査できる（「レコードが増えない」などの確認用）
 * 本物の実装との結合は app 層の API テストで検証する。
 */
export class FakeAttendanceRepository implements IAttendanceRepository {
  private readonly store = new Map<string, Attendance>();
  private sequence = 0;

  nextId(): AttendanceId {
    this.sequence += 1;
    return AttendanceId.create(`att-${this.sequence}`);
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
      .sort((a, b) => byClockInDesc(b, a));
  }

  async findByEmployeeAndPeriod(employeeId: EmployeeId, from: BusinessDate, to: BusinessDate): Promise<Attendance[]> {
    return this.ofEmployee(employeeId)
      .filter((a) => !from.isAfter(a.businessDate) && !a.businessDate.isAfter(to))
      .sort((a, b) => a.businessDate.daysUntil(b.businessDate) || byClockInDesc(a, b));
  }

  /** テスト検査用: 保存されている全勤怠 */
  all(): Attendance[] {
    return [...this.store.values()];
  }

  private ofEmployee(employeeId: EmployeeId): Attendance[] {
    return this.all().filter((a) => a.employeeId.equals(employeeId));
  }
}

const byClockInDesc = (a: Attendance, b: Attendance) =>
  b.clockInTime.toDate().getTime() - a.clockInTime.toDate().getTime();
