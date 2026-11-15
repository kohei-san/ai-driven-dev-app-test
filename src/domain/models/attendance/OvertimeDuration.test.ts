import { describe, expect, it } from 'vitest';
import { OvertimeDuration } from './OvertimeDuration';
import { WorkDuration } from './WorkDuration';
import { ClockInTime } from './ClockInTime';
import { ClockOutTime } from './ClockOutTime';
import { BreakDuration } from './BreakDuration';
import { jst } from '../../../test-utils/jst';

/** 09:00 出勤・休憩 0 分で、指定した実働分の WorkDuration を作る */
const workOf = (minutes: number) => {
  const start = jst('2026-11-16T09:00');
  return WorkDuration.calculate(
    ClockInTime.create(start),
    ClockOutTime.create(new Date(start.getTime() + minutes * 60_000)),
    BreakDuration.create(0),
  );
};

describe('OvertimeDuration（残業時間）', () => {
  describe('fromWork: 所定労働時間 480 分を超えた分（BR-03）', () => {
    it.each([
      ['実働 1 分 → 0 分', 1, 0],
      ['実働 479 分 → 0 分', 479, 0],
      ['実働 480 分 → 0 分（所定ちょうど）', 480, 0],
      ['実働 481 分 → 1 分（境界値）', 481, 1],
      ['実働 630 分 → 150 分', 630, 150],
      ['実働 960 分 → 480 分', 960, 480],
    ])('%s', (_label, workMinutes, expected) => {
      expect(OvertimeDuration.fromWork(workOf(workMinutes)).minutes).toBe(expected);
    });
  });

  it('WorkDuration.overtime() と同じ結果になる', () => {
    const work = workOf(630);
    expect(OvertimeDuration.fromWork(work).minutes).toBe(work.overtime().minutes);
  });
});
