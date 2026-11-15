import { describe, expect, it } from 'vitest';
import { AttendanceId } from './AttendanceId';
import { DomainError } from '../../errors';

describe('AttendanceId（勤怠ID）', () => {
  describe('create', () => {
    it('空でない文字列からIDを生成できる', () => {
      expect(AttendanceId.create('att-1').value).toBe('att-1');
    });

    it('UUID 形式のIDを生成できる', () => {
      const uuid = '0b8f9c1e-6c2a-4a36-9a2d-5f1d2e3c4b5a';
      expect(AttendanceId.create(uuid).value).toBe(uuid);
    });

    it.each([
      ['空文字', ''],
      ['空白のみ', '   '],
    ])('%s は DomainError', (_label, input) => {
      expect(() => AttendanceId.create(input)).toThrow(DomainError);
    });
  });

  describe('equals', () => {
    it('同じ値なら等しい', () => {
      expect(AttendanceId.create('att-1').equals(AttendanceId.create('att-1'))).toBe(true);
    });

    it('異なる値なら等しくない', () => {
      expect(AttendanceId.create('att-1').equals(AttendanceId.create('att-2'))).toBe(false);
    });
  });

  describe('toString', () => {
    it('値を文字列として返す', () => {
      expect(AttendanceId.create('att-1').toString()).toBe('att-1');
    });
  });
});
