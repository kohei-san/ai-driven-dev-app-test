import { describe, expect, it } from 'vitest';
import { EmployeeId } from './EmployeeId';
import { InvalidEmployeeIdError, ValidationError } from '../../errors';

describe('EmployeeId（従業員ID）', () => {
  describe('create: 正常系', () => {
    it('英数字とハイフンからなるIDを生成できる', () => {
      expect(EmployeeId.create('emp-001').value).toBe('emp-001');
    });

    it('アンダースコアを含むIDを生成できる', () => {
      expect(EmployeeId.create('emp_001').value).toBe('emp_001');
    });

    it('前後の空白は除去される', () => {
      expect(EmployeeId.create('  emp-001 \t').value).toBe('emp-001');
    });

    it('1文字のIDを生成できる（下限）', () => {
      expect(EmployeeId.create('a').value).toBe('a');
    });

    it('64文字のIDを生成できる（上限）', () => {
      const value = 'a'.repeat(64);
      expect(EmployeeId.create(value).value).toBe(value);
    });
  });

  describe('create: 異常系（BR-05 / AC-05-4）', () => {
    it.each([
      ['空文字', ''],
      ['空白のみ', '   '],
      ['65文字（上限超過）', 'a'.repeat(65)],
      ['途中に空白を含む', 'emp 001'],
      ['記号 @ を含む', 'emp@001'],
      ['スラッシュを含む', 'emp/001'],
      ['全角文字を含む', '社員001'],
    ])('%s は InvalidEmployeeIdError', (_label, input) => {
      expect(() => EmployeeId.create(input)).toThrow(InvalidEmployeeIdError);
    });

    it('InvalidEmployeeIdError は ValidationError の一種として扱える', () => {
      expect(() => EmployeeId.create('')).toThrow(ValidationError);
    });
  });

  describe('equals', () => {
    it('同じ値なら等しい', () => {
      expect(EmployeeId.create('emp-001').equals(EmployeeId.create('emp-001'))).toBe(true);
    });

    it('空白除去後に同じ値なら等しい', () => {
      expect(EmployeeId.create(' emp-001 ').equals(EmployeeId.create('emp-001'))).toBe(true);
    });

    it('異なる値なら等しくない', () => {
      expect(EmployeeId.create('emp-001').equals(EmployeeId.create('emp-002'))).toBe(false);
    });

    it('大文字・小文字は区別する', () => {
      expect(EmployeeId.create('EMP-001').equals(EmployeeId.create('emp-001'))).toBe(false);
    });
  });

  describe('toString', () => {
    it('値を文字列として返す', () => {
      expect(EmployeeId.create('emp-001').toString()).toBe('emp-001');
    });
  });
});
