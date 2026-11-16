import { NotClockedInError } from '../../domain/errors';
import { BreakDuration } from '../../domain/models/attendance/BreakDuration';
import { ClockOutTime } from '../../domain/models/attendance/ClockOutTime';
import { EmployeeId } from '../../domain/models/attendance/EmployeeId';
import type { IAttendanceRepository } from '../../domain/repositories/IAttendanceRepository';
import type { AttendanceDto, ClockOutInput } from '../dto/AttendanceDto';
import { AttendanceDtoMapper } from '../dto/AttendanceDtoMapper';
import type { IClock } from '../ports/IClock';

export type ClockOutUseCaseDeps = {
  readonly attendanceRepository: IAttendanceRepository;
  readonly clock: IClock;
};

/**
 * 退勤打刻（F-02）。
 * 退勤対象は「営業日」ではなく「出勤時刻が最新の出勤中勤怠」で探す（日付またぎ勤務 AC-01-4 に対応）。
 */
export class ClockOutUseCase {
  constructor(private readonly deps: ClockOutUseCaseDeps) {}

  async execute(input: ClockOutInput): Promise<AttendanceDto> {
    const { attendanceRepository, clock } = this.deps;

    const employeeId = EmployeeId.create(input.employeeId);
    // 入力の形式チェックはリポジトリ検索より先に行う（BR-04 の形式部分）
    const breakDuration =
      input.breakMinutes === undefined ? BreakDuration.default() : BreakDuration.create(input.breakMinutes);

    const current = await attendanceRepository.findLatestWorkingByEmployee(employeeId);
    if (current === null) {
      throw new NotClockedInError();
    }

    // BR-01（退勤 > 出勤）と BR-04（休憩 < 拘束時間）はエンティティが検証する
    const finished = current.clockOut(ClockOutTime.create(clock.now()), breakDuration);
    await attendanceRepository.save(finished);

    return AttendanceDtoMapper.toDto(finished);
  }
}
