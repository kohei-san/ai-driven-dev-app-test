import { describe, expect, it } from 'vitest';
import { ClockInTime } from './ClockInTime';
import { InvalidClockTimeError } from '../../errors';
import { jst } from '../../../test-utils/jst';

describe('ClockInTime（出勤時刻）', () => {
  describe('create', () => {
    it('有効な Date から生成できる', () => {
      const date = jst('2026-11-16T09:00');
      expect(ClockInTime.create(date).toDate().getTime()).toBe(date.getTime());
    });

    it('不正な Date（Invalid Date）は InvalidClockTimeError', () => {
      expect(() => ClockInTime.create(new Date(Number.NaN))).toThrow(InvalidClockTimeError);
    });
  });

  describe('不変性（防御的コピー）', () => {
    it('生成後に元の Date を変更しても影響を受けない', () => {
      const date = jst('2026-11-16T09:00');
      const clockIn = ClockInTime.create(date);
      date.setFullYear(2000);
      expect(clockIn.toDate().getTime()).toBe(jst('2026-11-16T09:00').getTime());
    });

    it('toDate() で得た Date を変更しても影響を受けない', () => {
      const clockIn = ClockInTime.create(jst('2026-11-16T09:00'));
      clockIn.toDate().setFullYear(2000);
      expect(clockIn.toDate().getTime()).toBe(jst('2026-11-16T09:00').getTime());
    });
  });

  describe('toBusinessDate: 出勤時刻の JST 日付を営業日とする', () => {
    it.each([
      ['日中', '2026-11-16T09:00', '2026-11-16'],
      ['JST 00:00 ちょうど', '2026-11-16T00:00', '2026-11-16'],
      ['JST 23:59:59.999', '2026-11-16T23:59:59.999', '2026-11-16'],
      ['夜勤の出勤（22:00）', '2026-11-15T22:00', '2026-11-15'],
    ])('%s: %s → %s', (_label, local, expected) => {
      expect(ClockInTime.create(jst(local)).toBusinessDate().value).toBe(expected);
    });
  });
});
