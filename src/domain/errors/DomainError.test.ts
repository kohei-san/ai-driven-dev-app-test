import { describe, expect, it } from 'vitest';
import {
  AlreadyClockedInError,
  AttendanceAlreadyFinishedError,
  DomainError,
  InvalidBreakDurationError,
  InvalidBusinessDateError,
  InvalidClockOutTimeError,
  InvalidClockTimeError,
  InvalidEmployeeIdError,
  NotClockedInError,
  ValidationError,
} from './index';

type DomainErrorClass = new (message?: string) => DomainError;

const cases: Array<[name: string, ErrorClass: DomainErrorClass, code: string]> = [
  ['AlreadyClockedInError', AlreadyClockedInError, 'ALREADY_CLOCKED_IN'],
  ['NotClockedInError', NotClockedInError, 'NOT_CLOCKED_IN'],
  ['InvalidClockOutTimeError', InvalidClockOutTimeError, 'INVALID_CLOCK_OUT_TIME'],
  ['InvalidBreakDurationError', InvalidBreakDurationError, 'INVALID_BREAK_DURATION'],
  ['AttendanceAlreadyFinishedError', AttendanceAlreadyFinishedError, 'ATTENDANCE_ALREADY_FINISHED'],
  ['ValidationError', ValidationError, 'VALIDATION_ERROR'],
  ['InvalidEmployeeIdError', InvalidEmployeeIdError, 'VALIDATION_ERROR'],
  ['InvalidBusinessDateError', InvalidBusinessDateError, 'VALIDATION_ERROR'],
  ['InvalidClockTimeError', InvalidClockTimeError, 'VALIDATION_ERROR'],
];

describe('DomainError とその派生例外', () => {
  describe.each(cases)('%s', (name, ErrorClass, code) => {
    it(`エラーコード ${code} を持つ`, () => {
      expect(new ErrorClass().code).toBe(code);
    });

    it('DomainError かつ Error のインスタンスである', () => {
      const error = new ErrorClass();
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toBeInstanceOf(Error);
    });

    it('name にクラス名が設定される', () => {
      expect(new ErrorClass().name).toBe(name);
    });

    it('既定のメッセージ（空でない）を持つ', () => {
      expect(new ErrorClass().message.length).toBeGreaterThan(0);
    });

    it('任意のメッセージを指定できる', () => {
      expect(new ErrorClass('カスタムメッセージ').message).toBe('カスタムメッセージ');
    });
  });

  describe('ValidationError の派生', () => {
    it.each([
      ['InvalidEmployeeIdError', InvalidEmployeeIdError],
      ['InvalidBusinessDateError', InvalidBusinessDateError],
      ['InvalidClockTimeError', InvalidClockTimeError],
    ] as const)('%s は ValidationError のインスタンスである', (_name, ErrorClass) => {
      expect(new ErrorClass()).toBeInstanceOf(ValidationError);
    });
  });
});
