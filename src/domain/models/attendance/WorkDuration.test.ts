import { describe, expect, it } from 'vitest';
import { STANDARD_WORK_MINUTES, WorkDuration } from './WorkDuration';
import { OvertimeDuration } from './OvertimeDuration';
import { ClockInTime } from './ClockInTime';
import { ClockOutTime } from './ClockOutTime';
import { BreakDuration } from './BreakDuration';
import { DomainError } from '../../errors';
import { jst } from '../../../test-utils/jst';

const calc = (inLocal: string, outLocal: string, breakMinutes: number) =>
  WorkDuration.calculate(
    ClockInTime.create(jst(inLocal)),
    ClockOutTime.create(jst(outLocal)),
    BreakDuration.create(breakMinutes),
  );

describe('WorkDuration（実働時間）', () => {
  it('所定労働時間は 480 分（8 時間）', () => {
    expect(STANDARD_WORK_MINUTES).toBe(480);
  });

  describe('calculate: 実働 =（退勤 − 出勤）− 休憩（BR-03）', () => {
    it.each([
      ['AC-03-1: 09:00〜18:00・休憩60分', '2026-11-16T09:00', '2026-11-16T18:00', 60, 480],
      ['AC-03-2: 09:00〜20:30・休憩60分', '2026-11-16T09:00', '2026-11-16T20:30', 60, 630],
      ['AC-03-3: 09:00〜13:00・休憩0分', '2026-11-16T09:00', '2026-11-16T13:00', 0, 240],
      ['AC-03-4: 09:00〜18:01・休憩60分', '2026-11-16T09:00', '2026-11-16T18:01', 60, 481],
      ['AC-03-5: 09:00:00〜18:00:59・休憩60分（秒切り捨て）', '2026-11-16T09:00', '2026-11-16T18:00:59', 60, 480],
      ['日付またぎ 22:00〜翌06:00・休憩60分', '2026-11-15T22:00', '2026-11-16T06:00', 60, 420],
      ['休憩と拘束時間が同じなら 0 分', '2026-11-16T09:00', '2026-11-16T10:00', 60, 0],
    ])('%s → %i 分', (_label, inLocal, outLocal, breakMinutes, expected) => {
      expect(calc(inLocal, outLocal, breakMinutes).minutes).toBe(expected);
    });

    it('休憩が拘束時間を超えて実働が負になる場合は DomainError', () => {
      expect(() => calc('2026-11-16T09:00', '2026-11-16T10:00', 61)).toThrow(DomainError);
    });
  });

  describe('overtime: 残業 = max(0, 実働 − 480)', () => {
    it.each([
      ['AC-03-1: 実働480分 → 残業0分（所定ちょうど）', '2026-11-16T18:00', 0],
      ['AC-03-4: 実働481分 → 残業1分（境界値）', '2026-11-16T18:01', 1],
      ['AC-03-2: 実働630分 → 残業150分', '2026-11-16T20:30', 150],
      ['実働479分 → 残業0分', '2026-11-16T17:59', 0],
    ])('%s', (_label, outLocal, expected) => {
      const overtime = calc('2026-11-16T09:00', outLocal, 60).overtime();
      expect(overtime).toBeInstanceOf(OvertimeDuration);
      expect(overtime.minutes).toBe(expected);
    });

    it('AC-03-3: 実働240分 → 残業0分', () => {
      expect(calc('2026-11-16T09:00', '2026-11-16T13:00', 0).overtime().minutes).toBe(0);
    });
  });
});
