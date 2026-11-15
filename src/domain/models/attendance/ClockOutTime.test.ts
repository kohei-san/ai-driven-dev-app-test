import { describe, expect, it } from 'vitest';
import { ClockOutTime } from './ClockOutTime';
import { ClockInTime } from './ClockInTime';
import { InvalidClockTimeError } from '../../errors';
import { jst } from '../../../test-utils/jst';

const clockIn = (local: string) => ClockInTime.create(jst(local));
const clockOut = (local: string) => ClockOutTime.create(jst(local));

describe('ClockOutTime（退勤時刻）', () => {
  describe('create', () => {
    it('有効な Date から生成できる', () => {
      const date = jst('2026-11-16T18:00');
      expect(ClockOutTime.create(date).toDate().getTime()).toBe(date.getTime());
    });

    it('不正な Date（Invalid Date）は InvalidClockTimeError', () => {
      expect(() => ClockOutTime.create(new Date(Number.NaN))).toThrow(InvalidClockTimeError);
    });
  });

  describe('不変性（防御的コピー）', () => {
    it('生成後に元の Date を変更しても影響を受けない', () => {
      const date = jst('2026-11-16T18:00');
      const out = ClockOutTime.create(date);
      date.setFullYear(2000);
      expect(out.toDate().getTime()).toBe(jst('2026-11-16T18:00').getTime());
    });

    it('toDate() で得た Date を変更しても影響を受けない', () => {
      const out = clockOut('2026-11-16T18:00');
      out.toDate().setFullYear(2000);
      expect(out.toDate().getTime()).toBe(jst('2026-11-16T18:00').getTime());
    });
  });

  describe('isAfter（BR-01 の判定手段）', () => {
    it('出勤時刻より後なら true', () => {
      expect(clockOut('2026-11-16T18:00').isAfter(clockIn('2026-11-16T09:00'))).toBe(true);
    });

    it('出勤時刻の 1 ミリ秒後なら true（境界値）', () => {
      expect(clockOut('2026-11-16T09:00:00.001').isAfter(clockIn('2026-11-16T09:00'))).toBe(true);
    });

    it('出勤時刻と同時刻なら false（AC-01-2）', () => {
      expect(clockOut('2026-11-16T09:00').isAfter(clockIn('2026-11-16T09:00'))).toBe(false);
    });

    it('出勤時刻より前なら false（AC-01-3）', () => {
      expect(clockOut('2026-11-16T08:59').isAfter(clockIn('2026-11-16T09:00'))).toBe(false);
    });

    it('日付をまたいだ退勤でも後なら true（AC-01-4）', () => {
      expect(clockOut('2026-11-16T06:00').isAfter(clockIn('2026-11-15T22:00'))).toBe(true);
    });
  });

  describe('minutesSince（出勤からの経過分。秒以下切り捨て）', () => {
    it.each([
      ['09:00 → 18:00 は 540 分', '2026-11-16T09:00', '2026-11-16T18:00', 540],
      ['09:00:00 → 18:00:59 は 540 分（秒切り捨て）', '2026-11-16T09:00', '2026-11-16T18:00:59.999', 540],
      ['09:00:00 → 09:00:59 は 0 分', '2026-11-16T09:00', '2026-11-16T09:00:59', 0],
      ['09:00:30 → 09:01:00 は 0 分（30秒）', '2026-11-16T09:00:30', '2026-11-16T09:01', 0],
      ['日付またぎ 22:00 → 翌 06:00 は 480 分', '2026-11-15T22:00', '2026-11-16T06:00', 480],
    ])('%s', (_label, inLocal, outLocal, expected) => {
      expect(clockOut(outLocal).minutesSince(clockIn(inLocal))).toBe(expected);
    });
  });
});
