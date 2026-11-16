import type { Attendance } from '../models/attendance/Attendance';
import type { AttendanceId } from '../models/attendance/AttendanceId';
import type { BusinessDate } from '../models/attendance/BusinessDate';
import type { EmployeeId } from '../models/attendance/EmployeeId';

/**
 * 勤怠リポジトリ（ドメイン層のインターフェース）。
 * 実装は infrastructure 層に置き、引数・返り値にはドメインオブジェクトのみを使う。
 */
export interface IAttendanceRepository {
  /** 新しい勤怠IDを払い出す（ID 生成戦略は永続化側に委ねる） */
  nextId(): AttendanceId;

  /** 新規作成・更新（ID で同一性を判定する upsert） */
  save(attendance: Attendance): Promise<void>;

  findById(id: AttendanceId): Promise<Attendance | null>;

  /** 指定従業員・営業日の「出勤中」の勤怠（二重打刻チェック用） */
  findWorkingByEmployeeAndDate(employeeId: EmployeeId, businessDate: BusinessDate): Promise<Attendance | null>;

  /** 営業日を問わず、出勤時刻が最新の「出勤中」の勤怠（退勤対象の検索用。日付またぎ勤務に対応） */
  findLatestWorkingByEmployee(employeeId: EmployeeId): Promise<Attendance | null>;

  /** 指定営業日の勤怠すべて（出勤時刻の昇順） */
  findByEmployeeAndDate(employeeId: EmployeeId, businessDate: BusinessDate): Promise<Attendance[]>;

  /** 期間内（両端を含む）の勤怠（営業日の降順 → 出勤時刻の降順） */
  findByEmployeeAndPeriod(employeeId: EmployeeId, from: BusinessDate, to: BusinessDate): Promise<Attendance[]>;
}
