import { AlreadyClockedInError } from '../errors';
import type { BusinessDate } from '../models/attendance/BusinessDate';
import type { EmployeeId } from '../models/attendance/EmployeeId';
import type { IAttendanceRepository } from '../repositories/IAttendanceRepository';

/**
 * 二重打刻の防止（BR-02）を担うドメインサービス。
 *
 * 「他の勤怠レコードが存在するか」に依存するルールで、新しく生成する Attendance 自身は
 * 判定に必要な情報を持たないため、エンティティではなくドメインサービスに置く。
 */
export class AttendanceDuplicationChecker {
  constructor(private readonly repository: IAttendanceRepository) {}

  /** 同一従業員・同一営業日に出勤中の勤怠があれば AlreadyClockedInError を投げる */
  async ensureCanClockIn(employeeId: EmployeeId, businessDate: BusinessDate): Promise<void> {
    const working = await this.repository.findWorkingByEmployeeAndDate(employeeId, businessDate);
    if (working !== null) {
      throw new AlreadyClockedInError();
    }
  }
}
