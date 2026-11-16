import { Attendance } from '../../domain/models/attendance/Attendance';
import { ClockInTime } from '../../domain/models/attendance/ClockInTime';
import { EmployeeId } from '../../domain/models/attendance/EmployeeId';
import type { IAttendanceRepository } from '../../domain/repositories/IAttendanceRepository';
import type { AttendanceDuplicationChecker } from '../../domain/services/AttendanceDuplicationChecker';
import type { AttendanceDto, ClockInInput } from '../dto/AttendanceDto';
import { AttendanceDtoMapper } from '../dto/AttendanceDtoMapper';
import type { IClock } from '../ports/IClock';

export type ClockInUseCaseDeps = {
  readonly attendanceRepository: IAttendanceRepository;
  readonly duplicationChecker: AttendanceDuplicationChecker;
  readonly clock: IClock;
};

/**
 * 出勤打刻（F-01）。
 * 打刻時刻はクライアントの値ではなくサーバーの現在時刻を使う（P-2）。
 */
export class ClockInUseCase {
  constructor(private readonly deps: ClockInUseCaseDeps) {}

  async execute(input: ClockInInput): Promise<AttendanceDto> {
    const { attendanceRepository, duplicationChecker, clock } = this.deps;

    const employeeId = EmployeeId.create(input.employeeId);
    const clockInTime = ClockInTime.create(clock.now());

    // BR-02: 同一営業日に出勤中の勤怠があれば AlreadyClockedInError
    await duplicationChecker.ensureCanClockIn(employeeId, clockInTime.toBusinessDate());

    const attendance = Attendance.clockIn({ id: attendanceRepository.nextId(), employeeId, clockInTime });
    await attendanceRepository.save(attendance);

    return AttendanceDtoMapper.toDto(attendance);
  }
}
