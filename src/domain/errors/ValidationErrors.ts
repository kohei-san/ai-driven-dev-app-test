import { DomainError } from './DomainError';

/** 入力値の形式不正。値オブジェクトの生成時バリデーションで使う。 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';

  constructor(message = '入力値が不正です') {
    super(message);
  }
}

/** 従業員IDの形式不正（BR-05） */
export class InvalidEmployeeIdError extends ValidationError {
  constructor(message = '従業員IDの形式が不正です') {
    super(message);
  }
}

/** 営業日（YYYY-MM-DD）の形式不正・存在しない日付 */
export class InvalidBusinessDateError extends ValidationError {
  constructor(message = '営業日の形式が不正です') {
    super(message);
  }
}

/** 打刻時刻が不正な日時（Invalid Date） */
export class InvalidClockTimeError extends ValidationError {
  constructor(message = '打刻時刻が不正です') {
    super(message);
  }
}
