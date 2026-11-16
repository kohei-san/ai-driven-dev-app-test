import { BusinessDate } from '../../domain/models/attendance/BusinessDate';
import { EmployeeId } from '../../domain/models/attendance/EmployeeId';
import type { IAttendanceRepository } from '../../domain/repositories/IAttendanceRepository';
import type { GetTodayAttendanceInput, TodayAttendanceDto } from '../dto/AttendanceDto';
import { AttendanceDtoMapper } from '../dto/AttendanceDtoMapper';
import type { IClock } from '../ports/IClock';

export type GetTodayAttendanceUseCaseDeps = {
  readonly attendanceRepository: IAttendanceRepository;
  readonly clock: IClock;
};

/**
 * 当日の勤怠状況（F-03）。
 *
 * 1. 本日の営業日に勤怠があれば、出勤時刻が最新のものを返す（退勤後の再出勤にも対応）
 * 2. なければ、営業日を問わず出勤中の勤怠を返す
 *    （22:00 出勤 → 翌 02:00 に画面を開いた場合でも「出勤中」と表示し、退勤できるようにするため。
 *     退勤 API の対象＝ findLatestWorkingByEmployee と同じ基準にそろえている）
 * 3. どちらもなければ NOT_STARTED
 */
export class GetTodayAttendanceUseCase {
  constructor(private readonly deps: GetTodayAttendanceUseCaseDeps) {}

  async execute(input: GetTodayAttendanceInput): Promise<TodayAttendanceDto> {
    const { attendanceRepository, clock } = this.deps;

    const employeeId = EmployeeId.create(input.employeeId);
    const today = BusinessDate.fromInstant(clock.now());

    // findByEmployeeAndDate は出勤時刻の昇順なので末尾が最新
    const todays = await attendanceRepository.findByEmployeeAndDate(employeeId, today);
    const latest = todays.at(-1) ?? (await attendanceRepository.findLatestWorkingByEmployee(employeeId));

    if (latest === null) {
      return { businessDate: today.value, status: 'NOT_STARTED', attendance: null };
    }
    return { businessDate: today.value, status: latest.status(), attendance: AttendanceDtoMapper.toDto(latest) };
  }
}
