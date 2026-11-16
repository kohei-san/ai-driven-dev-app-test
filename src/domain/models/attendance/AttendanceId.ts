import { ValidationError } from '../../errors';

/** 勤怠ID（値オブジェクト）。ID の生成戦略はリポジトリ（nextId）に委ねる。 */
export class AttendanceId {
  private constructor(readonly value: string) {}

  static create(value: string): AttendanceId {
    if (value.trim().length === 0) {
      throw new ValidationError('勤怠IDが空です');
    }
    return new AttendanceId(value);
  }

  equals(other: AttendanceId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
