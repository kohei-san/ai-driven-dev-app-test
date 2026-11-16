import { ValidationError } from '../../domain/errors';
import { BusinessDate } from '../../domain/models/attendance/BusinessDate';
import { EmployeeId } from '../../domain/models/attendance/EmployeeId';
import type { IAttendanceRepository } from '../../domain/repositories/IAttendanceRepository';
import type { AttendanceListDto, GetAttendanceListInput } from '../dto/AttendanceDto';
import { AttendanceDtoMapper } from '../dto/AttendanceDtoMapper';
import type { IClock } from '../ports/IClock';

/**
 * 1 回の取得で指定できる期間の上限（from から to までの日数）。
 * 業務ルールではなくシステム保護のための入力制約なので、ドメインではなくユースケースに置く。
 */
export const MAX_PERIOD_DAYS = 93;

export type GetAttendanceListUseCaseDeps = {
  readonly attendanceRepository: IAttendanceRepository;
  readonly clock: IClock;
};

/** 同じ月の 1 日 */
const firstDayOfMonth = (date: BusinessDate): BusinessDate => BusinessDate.create(`${date.value.slice(0, 7)}-01`);

/** 勤怠履歴一覧（F-04） */
export class GetAttendanceListUseCase {
  constructor(private readonly deps: GetAttendanceListUseCaseDeps) {}

  async execute(input: GetAttendanceListInput): Promise<AttendanceListDto> {
    const { attendanceRepository, clock } = this.deps;

    const employeeId = EmployeeId.create(input.employeeId);
    const today = BusinessDate.fromInstant(clock.now());

    // 空文字は「省略」ではなく不正な日付として扱う（省略の解釈は呼び出し側の責務）
    const to = input.to === undefined ? today : BusinessDate.create(input.to);
    const from = input.from === undefined ? firstDayOfMonth(to) : BusinessDate.create(input.from);

    if (from.isAfter(to)) {
      throw new ValidationError(`期間の開始日（${from.value}）は終了日（${to.value}）以前にしてください`);
    }
    if (from.daysUntil(to) > MAX_PERIOD_DAYS) {
      throw new ValidationError(`期間は ${MAX_PERIOD_DAYS} 日以内で指定してください`);
    }

    const attendances = await attendanceRepository.findByEmployeeAndPeriod(employeeId, from, to);
    const items = attendances.map((attendance) => AttendanceDtoMapper.toDto(attendance));

    return {
      from: from.value,
      to: to.value,
      items,
      // 出勤中の勤怠は null なので 0 として集計から外れる
      totalWorkMinutes: items.reduce((sum, item) => sum + (item.workMinutes ?? 0), 0),
      totalOvertimeMinutes: items.reduce((sum, item) => sum + (item.overtimeMinutes ?? 0), 0),
    };
  }
}
