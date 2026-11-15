import { describe, expect, it } from 'vitest';
import { BusinessDate } from './BusinessDate';
import { InvalidBusinessDateError } from '../../errors';

const d = (value: string) => BusinessDate.create(value);

describe('BusinessDate（営業日）', () => {
  describe('create: 正常系', () => {
    it('YYYY-MM-DD 形式の日付を生成できる', () => {
      expect(d('2026-11-16').value).toBe('2026-11-16');
    });

    it.each([
      ['うるう年の 2/29', '2024-02-29'],
      ['400で割り切れる年の 2/29', '2000-02-29'],
      ['月末 31 日', '2026-12-31'],
      ['月初 1 日', '2026-01-01'],
    ])('%s（%s）を生成できる', (_label, value) => {
      expect(d(value).value).toBe(value);
    });
  });

  describe('create: 異常系', () => {
    it.each([
      ['空文字', ''],
      ['スラッシュ区切り', '2026/11/16'],
      ['ゼロ埋めなし', '2026-1-1'],
      ['区切りなし', '20261116'],
      ['時刻付き', '2026-11-16T09:00'],
      ['存在しない日（2/30）', '2026-02-30'],
      ['平年の 2/29', '2026-02-29'],
      ['100で割り切れ400で割り切れない年の 2/29', '1900-02-29'],
      ['30日までの月の 31 日', '2026-04-31'],
      ['13 月', '2026-13-01'],
      ['0 月', '2026-00-10'],
      ['0 日', '2026-11-00'],
    ])('%s（"%s"）は InvalidBusinessDateError', (_label, value) => {
      expect(() => d(value)).toThrow(InvalidBusinessDateError);
    });
  });

  describe('fromInstant: JST の日付に変換する', () => {
    it.each([
      ['JST 00:00（UTC 前日 15:00）は当日', '2026-11-15T15:00:00.000Z', '2026-11-16'],
      ['JST 23:59:59.999 は当日', '2026-11-16T14:59:59.999Z', '2026-11-16'],
      ['JST 09:00 は当日', '2026-11-16T00:00:00.000Z', '2026-11-16'],
      ['JST の年またぎ（UTC 12/31 15:00 = JST 1/1 00:00）', '2026-12-31T15:00:00.000Z', '2027-01-01'],
      ['JST の月またぎ', '2026-11-30T15:00:00.000Z', '2026-12-01'],
    ])('%s', (_label, iso, expected) => {
      expect(BusinessDate.fromInstant(new Date(iso)).value).toBe(expected);
    });

    it('不正な Date は InvalidBusinessDateError', () => {
      expect(() => BusinessDate.fromInstant(new Date(Number.NaN))).toThrow(InvalidBusinessDateError);
    });
  });

  describe('equals', () => {
    it('同じ日付なら等しい', () => {
      expect(d('2026-11-16').equals(d('2026-11-16'))).toBe(true);
    });

    it('異なる日付なら等しくない', () => {
      expect(d('2026-11-16').equals(d('2026-11-17'))).toBe(false);
    });

    it('fromInstant と create で同じ日付なら等しい', () => {
      expect(BusinessDate.fromInstant(new Date('2026-11-16T00:00:00Z')).equals(d('2026-11-16'))).toBe(true);
    });
  });

  describe('isAfter', () => {
    it('後の日付なら true', () => {
      expect(d('2026-11-17').isAfter(d('2026-11-16'))).toBe(true);
    });

    it('同じ日付なら false', () => {
      expect(d('2026-11-16').isAfter(d('2026-11-16'))).toBe(false);
    });

    it('前の日付なら false', () => {
      expect(d('2026-11-15').isAfter(d('2026-11-16'))).toBe(false);
    });

    it('年をまたいでも正しく比較できる', () => {
      expect(d('2027-01-01').isAfter(d('2026-12-31'))).toBe(true);
    });
  });

  describe('daysUntil（相手の日付までの日数）', () => {
    it.each([
      ['同じ日は 0', '2026-11-16', '2026-11-16', 0],
      ['月内', '2026-11-01', '2026-11-16', 15],
      ['過去の日付は負数', '2026-11-16', '2026-11-01', -15],
      ['年またぎ', '2026-12-31', '2027-01-01', 1],
      ['うるう年の 2 月をまたぐ', '2024-02-28', '2024-03-01', 2],
      ['平年の 2 月をまたぐ', '2026-02-28', '2026-03-01', 1],
      ['期間上限の境界（93日）', '2026-08-15', '2026-11-16', 93],
    ])('%s: %s → %s = %i', (_label, from, to, expected) => {
      expect(d(from).daysUntil(d(to))).toBe(expected);
    });
  });

  describe('toString', () => {
    it('YYYY-MM-DD を返す', () => {
      expect(d('2026-11-16').toString()).toBe('2026-11-16');
    });
  });
});
