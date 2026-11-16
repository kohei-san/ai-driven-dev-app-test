import { beforeEach, describe, expect, it } from 'vitest';
import { GetAttendanceListUseCase } from './GetAttendanceListUseCase';
import { InvalidBusinessDateError, InvalidEmployeeIdError, ValidationError } from '../../domain/errors';
import { FakeAttendanceRepository } from '../../test-utils/FakeAttendanceRepository';
import { FixedClock } from '../../test-utils/FixedClock';
import { finishedAttendance, workingAttendance } from '../../test-utils/attendanceFixtures';
import { jst } from '../../test-utils/jst';

describe('GetAttendanceListUseCase（勤怠履歴一覧 / F-04）', () => {
  let repository: FakeAttendanceRepository;
  let clock: FixedClock;
  let useCase: GetAttendanceListUseCase;

  beforeEach(async () => {
    repository = new FakeAttendanceRepository();
    clock = new FixedClock(jst('2026-11-16T14:32'));
    useCase = new GetAttendanceListUseCase({ attendanceRepository: repository, clock });

    // 実働・残業: 10/31 = 480/0, 11/01 = 480/0, 11/13 = 485/5, 11/14 = 630/150, 11/16 = 出勤中
    for (const attendance of [
      finishedAttendance({ id: 'att-1031', clockIn: '2026-10-31T09:00', clockOut: '2026-10-31T18:00' }),
      finishedAttendance({ id: 'att-1101', clockIn: '2026-11-01T09:00', clockOut: '2026-11-01T18:00' }),
      finishedAttendance({ id: 'att-1113', clockIn: '2026-11-13T08:55', clockOut: '2026-11-13T18:00' }),
      finishedAttendance({ id: 'att-1114', clockIn: '2026-11-14T09:00', clockOut: '2026-11-14T20:30' }),
      workingAttendance({ id: 'att-1116', clockIn: '2026-11-16T09:02' }),
      finishedAttendance({ id: 'att-other', employeeId: 'emp-002', clockIn: '2026-11-14T09:00', clockOut: '2026-11-14T23:00' }),
    ]) {
      await repository.save(attendance);
    }
  });

  describe('期間の既定値', () => {
    it('from・to を省略すると「当月 1 日〜本日」を対象にする', async () => {
      const result = await useCase.execute({ employeeId: 'emp-001' });

      expect(result.from).toBe('2026-11-01');
      expect(result.to).toBe('2026-11-16');
      expect(result.items.map((item) => item.id)).toEqual(['att-1116', 'att-1114', 'att-1113', 'att-1101']);
    });

    it('from のみ指定すると to は本日になる', async () => {
      const result = await useCase.execute({ employeeId: 'emp-001', from: '2026-10-31' });

      expect(result.from).toBe('2026-10-31');
      expect(result.to).toBe('2026-11-16');
      expect(result.items).toHaveLength(5);
    });

    it('to のみ指定すると from は to と同じ月の 1 日になる', async () => {
      const result = await useCase.execute({ employeeId: 'emp-001', to: '2026-10-31' });

      expect(result.from).toBe('2026-10-01');
      expect(result.to).toBe('2026-10-31');
      expect(result.items.map((item) => item.id)).toEqual(['att-1031']);
    });

    it('本日が月初（JST 11/01 00:10）なら既定の期間は 11/01 の 1 日のみ', async () => {
      clock.set(jst('2026-11-01T00:10'));

      const result = await useCase.execute({ employeeId: 'emp-001' });

      expect(result.from).toBe('2026-11-01');
      expect(result.to).toBe('2026-11-01');
    });

    it('「本日」は JST で判定する（UTC 11/30 15:30 = JST 12/01 00:30 → 12 月）', async () => {
      clock.set(new Date('2026-11-30T15:30:00Z'));

      const result = await useCase.execute({ employeeId: 'emp-001' });

      expect(result.from).toBe('2026-12-01');
      expect(result.to).toBe('2026-12-01');
    });
  });

  describe('期間指定と結果の内容', () => {
    it('指定期間（両端を含む）の勤怠を営業日の降順で返す', async () => {
      const result = await useCase.execute({ employeeId: 'emp-001', from: '2026-11-13', to: '2026-11-14' });

      expect(result.items.map((item) => item.id)).toEqual(['att-1114', 'att-1113']);
    });

    it('各要素は AttendanceDto 形式', async () => {
      const result = await useCase.execute({ employeeId: 'emp-001', from: '2026-11-14', to: '2026-11-14' });

      expect(result.items[0]).toEqual({
        id: 'att-1114',
        employeeId: 'emp-001',
        businessDate: '2026-11-14',
        clockInAt: '2026-11-14T09:00:00+09:00',
        clockOutAt: '2026-11-14T20:30:00+09:00',
        breakMinutes: 60,
        workMinutes: 630,
        overtimeMinutes: 150,
        status: 'FINISHED',
      });
    });

    it('出勤中の勤怠も含み、実働・残業は null', async () => {
      const result = await useCase.execute({ employeeId: 'emp-001', from: '2026-11-16', to: '2026-11-16' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ id: 'att-1116', status: 'WORKING', workMinutes: null, overtimeMinutes: null });
    });

    it('実働・残業の合計は退勤済の勤怠のみを集計する', async () => {
      const result = await useCase.execute({ employeeId: 'emp-001' });

      expect(result.totalWorkMinutes).toBe(480 + 485 + 630);
      expect(result.totalOvertimeMinutes).toBe(0 + 5 + 150);
    });

    it('他の従業員の勤怠は含まない', async () => {
      const result = await useCase.execute({ employeeId: 'emp-002' });

      expect(result.items.map((item) => item.id)).toEqual(['att-other']);
    });

    it('該当がなければ空配列・合計 0', async () => {
      const result = await useCase.execute({ employeeId: 'emp-999' });

      expect(result).toEqual({ from: '2026-11-01', to: '2026-11-16', items: [], totalWorkMinutes: 0, totalOvertimeMinutes: 0 });
    });

    it('from と to が同じ日でもよい', async () => {
      const result = await useCase.execute({ employeeId: 'emp-001', from: '2026-11-13', to: '2026-11-13' });

      expect(result.items.map((item) => item.id)).toEqual(['att-1113']);
    });

    it('期間の上限境界: from から to まで 93 日は許可される', async () => {
      await expect(
        useCase.execute({ employeeId: 'emp-001', from: '2026-08-15', to: '2026-11-16' }),
      ).resolves.toMatchObject({ from: '2026-08-15', to: '2026-11-16' });
    });
  });

  describe('異常系', () => {
    it('from > to は ValidationError', async () => {
      await expect(useCase.execute({ employeeId: 'emp-001', from: '2026-11-16', to: '2026-11-15' })).rejects.toThrow(
        ValidationError,
      );
    });

    it('期間が 93 日を超える（94 日）は ValidationError', async () => {
      await expect(useCase.execute({ employeeId: 'emp-001', from: '2026-08-14', to: '2026-11-16' })).rejects.toThrow(
        ValidationError,
      );
    });

    it.each([
      ['from がスラッシュ区切り', { from: '2026/11/01' }],
      ['from が存在しない日付', { from: '2026-02-30' }],
      ['to が時刻付き', { to: '2026-11-16T00:00' }],
      ['from が空文字', { from: '' }],
    ])('%s は InvalidBusinessDateError', async (_label, period) => {
      await expect(useCase.execute({ employeeId: 'emp-001', ...period })).rejects.toThrow(InvalidBusinessDateError);
    });

    it('従業員IDが不正なら InvalidEmployeeIdError', async () => {
      await expect(useCase.execute({ employeeId: '' })).rejects.toThrow(InvalidEmployeeIdError);
    });
  });
});
