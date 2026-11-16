import { DomainError } from './DomainError';

/** 同一営業日に出勤中の勤怠がある状態での出勤打刻（BR-02） */
export class AlreadyClockedInError extends DomainError {
  readonly code = 'ALREADY_CLOCKED_IN';

  constructor(message = '本日はすでに出勤中です') {
    super(message);
  }
}

/** 出勤中の勤怠がない状態での退勤打刻（BR-02） */
export class NotClockedInError extends DomainError {
  readonly code = 'NOT_CLOCKED_IN';

  constructor(message = '出勤中の勤怠がありません') {
    super(message);
  }
}

/** 退勤時刻が出勤時刻以前（BR-01） */
export class InvalidClockOutTimeError extends DomainError {
  readonly code = 'INVALID_CLOCK_OUT_TIME';

  constructor(message = '退勤時刻は出勤時刻より後である必要があります') {
    super(message);
  }
}

/** 休憩時間が不正（負数・非整数、または拘束時間以上）（BR-04） */
export class InvalidBreakDurationError extends DomainError {
  readonly code = 'INVALID_BREAK_DURATION';

  constructor(message = '休憩時間が不正です') {
    super(message);
  }
}

/** 退勤済の勤怠に対する再度の退勤打刻 */
export class AttendanceAlreadyFinishedError extends DomainError {
  readonly code = 'ATTENDANCE_ALREADY_FINISHED';

  constructor(message = 'この勤怠はすでに退勤済です') {
    super(message);
  }
}

/**
 * 勤怠の不変条件違反（永続化データの破損など）。
 * 利用者の操作では発生しない想定のため、app 層では 500 として扱う。
 */
export class InvalidAttendanceStateError extends DomainError {
  readonly code = 'INVALID_ATTENDANCE_STATE';

  constructor(message = '勤怠データが不変条件を満たしていません') {
    super(message);
  }
}
