import { describe, expect, it } from 'vitest';
import { BreakDuration } from './BreakDuration';
import { InvalidBreakDurationError } from '../../errors';

describe('BreakDuration（休憩時間）', () => {
  describe('create: 正常系', () => {
    it.each([
      ['0 分（下限）', 0],
      ['45 分', 45],
      ['60 分', 60],
      ['大きな値（1000 分）', 1000],
    ])('%s を生成できる', (_label, minutes) => {
      expect(BreakDuration.create(minutes).minutes).toBe(minutes);
    });
  });

  describe('create: 異常系（BR-04 / AC-04-1, AC-04-2）', () => {
    it.each([
      ['負の値（-1）', -1],
      ['小数（30.5）', 30.5],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['-Infinity', Number.NEGATIVE_INFINITY],
    ])('%s は InvalidBreakDurationError', (_label, minutes) => {
      expect(() => BreakDuration.create(minutes)).toThrow(InvalidBreakDurationError);
    });
  });

  describe('default（AC-04-4）', () => {
    it('既定の休憩時間は 60 分', () => {
      expect(BreakDuration.default().minutes).toBe(60);
    });
  });
});
