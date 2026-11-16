import { InvalidEmployeeIdError } from '../../errors';

/** 1〜64 文字の英数字・ハイフン・アンダースコア */
const EMPLOYEE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * 従業員ID（値オブジェクト）。
 * 従業員集約への ID 参照であり、従業員そのものは保持しない。
 */
export class EmployeeId {
  private constructor(readonly value: string) {}

  /** 前後の空白を除去したうえで形式を検証する（BR-05） */
  static create(value: string): EmployeeId {
    const normalized = value.trim();
    if (!EMPLOYEE_ID_PATTERN.test(normalized)) {
      throw new InvalidEmployeeIdError(
        `従業員IDは1〜64文字の英数字・ハイフン・アンダースコアで指定してください: "${value}"`,
      );
    }
    return new EmployeeId(normalized);
  }

  equals(other: EmployeeId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
