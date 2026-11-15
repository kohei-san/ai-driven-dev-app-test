import { describe, expect, it } from 'vitest';
import { Attendance } from './Attendance';
import { AttendanceId } from './AttendanceId';
import { AttendanceStatus } from './AttendanceStatus';
import { BreakDuration } from './BreakDuration';
import { BusinessDate } from './BusinessDate';
import { ClockInTime } from './ClockInTime';
import { ClockOutTime } from './ClockOutTime';
import { EmployeeId } from './EmployeeId';
import {
  AttendanceAlreadyFinishedError,
  DomainError,
  InvalidBreakDurationError,
  InvalidClockOutTimeError,
} from '../../errors';
import { jst } from '../../../test-utils/jst';

// ---- テストデータ生成ヘルパー ----
const EMP = EmployeeId.create('emp-001');
const ATT_ID = AttendanceId.create('att-1');
const clockIn = (local: string) => ClockInTime.create(jst(local));
const clockOut = (local: string) => ClockOutTime.create(jst(local));
const brk = (minutes: number) => BreakDuration.create(minutes);
const date = (value: string) => BusinessDate.create(value);

const startWork = (local = '2026-11-16T09:00') =>
  Attendance.clockIn({ id: ATT_ID, employeeId: EMP, clockInTime: clockIn(local) });

describe('Attendance（勤怠 / 集約ルート）', () => {
  describe('clockIn: 出勤打刻で生成する', () => {
    it('指定した ID・従業員・出勤時刻を持つ', () => {
      const attendance = startWork('2026-11-16T09:00');
      expect(attendance.id.equals(ATT_ID)).toBe(true);
      expect(attendance.employeeId.equals(EMP)).toBe(true);
      expect(attendance.clockInTime.toDate().getTime()).toBe(jst('2026-11-16T09:00').getTime());
    });

    it('ステータスは出勤中（WORKING）', () => {
      const attendance = startWork();
      expect(attendance.status()).toBe(AttendanceStatus.WORKING);
      expect(attendance.isWorking()).toBe(true);
    });

    it('営業日は出勤時刻の JST 日付になる', () => {
      expect(startWork('2026-11-16T09:00').businessDate.value).toBe('2026-11-16');
    });

    it('JST 00:00 ちょうどの出勤はその日の営業日になる', () => {
      expect(startWork('2026-11-16T00:00').businessDate.value).toBe('2026-11-16');
    });

    it('退勤時刻・休憩時間は未設定（null）', () => {
      const attendance = startWork();
      expect(attendance.clockOutTime).toBeNull();
      expect(attendance.breakDuration).toBeNull();
    });

    it('出勤中は実働時間・残業時間を算出しない（null）', () => {
      const attendance = startWork();
      expect(attendance.workDuration()).toBeNull();
      expect(attendance.overtimeDuration()).toBeNull();
    });
  });

  describe('clockOut: 退勤打刻（正常系）', () => {
    it('退勤済（FINISHED）の勤怠を返す', () => {
      const finished = startWork().clockOut(clockOut('2026-11-16T18:00'), brk(60));
      expect(finished.status()).toBe(AttendanceStatus.FINISHED);
      expect(finished.isWorking()).toBe(false);
    });

    it('退勤時刻と休憩時間が記録される', () => {
      const finished = startWork().clockOut(clockOut('2026-11-16T18:00'), brk(45));
      expect(finished.clockOutTime?.toDate().getTime()).toBe(jst('2026-11-16T18:00').getTime());
      expect(finished.breakDuration?.minutes).toBe(45);
    });

    it('ID・従業員・営業日・出勤時刻は変わらない', () => {
      const working = startWork('2026-11-16T09:00');
      const finished = working.clockOut(clockOut('2026-11-16T18:00'), brk(60));
      expect(finished.id.equals(working.id)).toBe(true);
      expect(finished.employeeId.equals(working.employeeId)).toBe(true);
      expect(finished.businessDate.equals(working.businessDate)).toBe(true);
      expect(finished.clockInTime.toDate().getTime()).toBe(working.clockInTime.toDate().getTime());
    });

    it('元のインスタンスは変更されない（新しいインスタンスを返す / D-4）', () => {
      const working = startWork();
      const finished = working.clockOut(clockOut('2026-11-16T18:00'), brk(60));
      expect(finished).not.toBe(working);
      expect(working.status()).toBe(AttendanceStatus.WORKING);
      expect(working.clockOutTime).toBeNull();
      expect(working.breakDuration).toBeNull();
    });

    it('AC-01-1: 09:00 出勤 → 18:00 退勤できる', () => {
      expect(() => startWork('2026-11-16T09:00').clockOut(clockOut('2026-11-16T18:00'), brk(60))).not.toThrow();
    });

    it('AC-01-4: 日付をまたいで退勤しても営業日は出勤日のまま', () => {
      const finished = startWork('2026-11-15T22:00').clockOut(clockOut('2026-11-16T06:00'), brk(60));
      expect(finished.businessDate.value).toBe('2026-11-15');
      expect(finished.workDuration()?.minutes).toBe(420);
    });

    it('出勤の 1 ミリ秒後の退勤は許可される（BR-01 の境界値）', () => {
      const finished = startWork('2026-11-16T09:00').clockOut(clockOut('2026-11-16T09:00:00.001'), brk(0));
      expect(finished.status()).toBe(AttendanceStatus.FINISHED);
      expect(finished.workDuration()?.minutes).toBe(0);
    });

    it('休憩が拘束時間より 1 ミリ秒でも短ければ許可される（BR-04 の境界値）', () => {
      // 拘束 60分30秒・休憩 60 分 → 実働は秒切り捨てで 0 分
      const finished = startWork('2026-11-16T09:00').clockOut(clockOut('2026-11-16T10:00:30'), brk(60));
      expect(finished.workDuration()?.minutes).toBe(0);
    });
  });

  describe('clockOut: 実働時間・残業時間の算出（BR-03）', () => {
    it.each([
      ['AC-03-1', '2026-11-16T18:00', 60, 480, 0],
      ['AC-03-2', '2026-11-16T20:30', 60, 630, 150],
      ['AC-03-3', '2026-11-16T13:00', 0, 240, 0],
      ['AC-03-4', '2026-11-16T18:01', 60, 481, 1],
      ['AC-03-5', '2026-11-16T18:00:59', 60, 480, 0],
    ])('%s: 09:00 出勤 → %s 退勤・休憩 %i 分 → 実働 %i 分・残業 %i 分', (_id, outLocal, breakMinutes, work, overtime) => {
      const finished = startWork('2026-11-16T09:00').clockOut(clockOut(outLocal), brk(breakMinutes));
      expect(finished.workDuration()?.minutes).toBe(work);
      expect(finished.overtimeDuration()?.minutes).toBe(overtime);
    });
  });

  describe('clockOut: 異常系', () => {
    it('AC-01-2: 出勤と同時刻の退勤は InvalidClockOutTimeError', () => {
      expect(() => startWork('2026-11-16T09:00').clockOut(clockOut('2026-11-16T09:00'), brk(0))).toThrow(
        InvalidClockOutTimeError,
      );
    });

    it('AC-01-3: 出勤より前の退勤は InvalidClockOutTimeError', () => {
      expect(() => startWork('2026-11-16T09:00').clockOut(clockOut('2026-11-16T08:59'), brk(0))).toThrow(
        InvalidClockOutTimeError,
      );
    });

    it('前日の日付での退勤は InvalidClockOutTimeError', () => {
      expect(() => startWork('2026-11-16T09:00').clockOut(clockOut('2026-11-15T18:00'), brk(0))).toThrow(
        InvalidClockOutTimeError,
      );
    });

    it('AC-04-3: 休憩が拘束時間と同じ（09:00〜10:00・休憩60分）は InvalidBreakDurationError', () => {
      expect(() => startWork('2026-11-16T09:00').clockOut(clockOut('2026-11-16T10:00'), brk(60))).toThrow(
        InvalidBreakDurationError,
      );
    });

    it('休憩が拘束時間を超える（09:00〜10:00・休憩90分）は InvalidBreakDurationError', () => {
      expect(() => startWork('2026-11-16T09:00').clockOut(clockOut('2026-11-16T10:00'), brk(90))).toThrow(
        InvalidBreakDurationError,
      );
    });

    it('退勤済の勤怠を再度退勤すると AttendanceAlreadyFinishedError', () => {
      const finished = startWork().clockOut(clockOut('2026-11-16T18:00'), brk(60));
      expect(() => finished.clockOut(clockOut('2026-11-16T19:00'), brk(60))).toThrow(AttendanceAlreadyFinishedError);
    });

    it('退勤済チェックは時刻チェックより優先される', () => {
      const finished = startWork('2026-11-16T09:00').clockOut(clockOut('2026-11-16T18:00'), brk(60));
      expect(() => finished.clockOut(clockOut('2026-11-16T08:00'), brk(60))).toThrow(AttendanceAlreadyFinishedError);
    });

    it('例外発生時、元のインスタンスは出勤中のまま', () => {
      const working = startWork('2026-11-16T09:00');
      expect(() => working.clockOut(clockOut('2026-11-16T08:00'), brk(0))).toThrow();
      expect(working.status()).toBe(AttendanceStatus.WORKING);
      expect(working.clockOutTime).toBeNull();
    });
  });

  describe('reconstruct: 永続化データからの復元', () => {
    it('出勤中の勤怠を復元できる', () => {
      const attendance = Attendance.reconstruct({
        id: ATT_ID,
        employeeId: EMP,
        businessDate: date('2026-11-16'),
        clockInTime: clockIn('2026-11-16T09:00'),
        clockOutTime: null,
        breakDuration: null,
      });
      expect(attendance.status()).toBe(AttendanceStatus.WORKING);
      expect(attendance.businessDate.value).toBe('2026-11-16');
    });

    it('退勤済の勤怠を復元でき、実働・残業が算出される', () => {
      const attendance = Attendance.reconstruct({
        id: ATT_ID,
        employeeId: EMP,
        businessDate: date('2026-11-16'),
        clockInTime: clockIn('2026-11-16T09:00'),
        clockOutTime: clockOut('2026-11-16T20:30'),
        breakDuration: brk(60),
      });
      expect(attendance.status()).toBe(AttendanceStatus.FINISHED);
      expect(attendance.workDuration()?.minutes).toBe(630);
      expect(attendance.overtimeDuration()?.minutes).toBe(150);
    });

    it('日付をまたぐ退勤済の勤怠を復元できる', () => {
      const attendance = Attendance.reconstruct({
        id: ATT_ID,
        employeeId: EMP,
        businessDate: date('2026-11-15'),
        clockInTime: clockIn('2026-11-15T22:00'),
        clockOutTime: clockOut('2026-11-16T06:00'),
        breakDuration: brk(60),
      });
      expect(attendance.businessDate.value).toBe('2026-11-15');
    });

    describe('不変条件違反は例外', () => {
      it('退勤時刻のみあり・休憩なし（不変条件1）は DomainError', () => {
        expect(() =>
          Attendance.reconstruct({
            id: ATT_ID,
            employeeId: EMP,
            businessDate: date('2026-11-16'),
            clockInTime: clockIn('2026-11-16T09:00'),
            clockOutTime: clockOut('2026-11-16T18:00'),
            breakDuration: null,
          }),
        ).toThrow(DomainError);
      });

      it('休憩のみあり・退勤時刻なし（不変条件1）は DomainError', () => {
        expect(() =>
          Attendance.reconstruct({
            id: ATT_ID,
            employeeId: EMP,
            businessDate: date('2026-11-16'),
            clockInTime: clockIn('2026-11-16T09:00'),
            clockOutTime: null,
            breakDuration: brk(60),
          }),
        ).toThrow(DomainError);
      });

      it('退勤時刻が出勤時刻以前（不変条件2）は InvalidClockOutTimeError', () => {
        expect(() =>
          Attendance.reconstruct({
            id: ATT_ID,
            employeeId: EMP,
            businessDate: date('2026-11-16'),
            clockInTime: clockIn('2026-11-16T09:00'),
            clockOutTime: clockOut('2026-11-16T09:00'),
            breakDuration: brk(0),
          }),
        ).toThrow(InvalidClockOutTimeError);
      });

      it('休憩が拘束時間以上（不変条件3）は InvalidBreakDurationError', () => {
        expect(() =>
          Attendance.reconstruct({
            id: ATT_ID,
            employeeId: EMP,
            businessDate: date('2026-11-16'),
            clockInTime: clockIn('2026-11-16T09:00'),
            clockOutTime: clockOut('2026-11-16T10:00'),
            breakDuration: brk(60),
          }),
        ).toThrow(InvalidBreakDurationError);
      });

      it('営業日が出勤時刻の JST 日付と一致しない（不変条件4）は DomainError', () => {
        expect(() =>
          Attendance.reconstruct({
            id: ATT_ID,
            employeeId: EMP,
            businessDate: date('2026-11-15'),
            clockInTime: clockIn('2026-11-16T09:00'),
            clockOutTime: null,
            breakDuration: null,
          }),
        ).toThrow(DomainError);
      });
    });
  });

  describe('equals: 同一性は ID のみで判定する', () => {
    it('ID が同じなら状態が違っても同一', () => {
      const working = startWork();
      const finished = working.clockOut(clockOut('2026-11-16T18:00'), brk(60));
      expect(working.equals(finished)).toBe(true);
    });

    it('ID が違えば同じ内容でも別物', () => {
      const a = Attendance.clockIn({ id: AttendanceId.create('att-1'), employeeId: EMP, clockInTime: clockIn('2026-11-16T09:00') });
      const b = Attendance.clockIn({ id: AttendanceId.create('att-2'), employeeId: EMP, clockInTime: clockIn('2026-11-16T09:00') });
      expect(a.equals(b)).toBe(false);
    });
  });
});
