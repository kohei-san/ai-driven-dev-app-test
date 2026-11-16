import { InvalidBusinessDateError } from '../../errors';

const DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** 日本標準時（UTC+9）。夏時間がないため固定オフセットで扱える。 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const pad = (n: number, length: number) => String(n).padStart(length, '0');

/**
 * 営業日（値オブジェクト）。勤怠が帰属する JST の日付。
 * 内部では比較・日数計算のために「1970-01-01 からの通算日数」も保持する。
 */
export class BusinessDate {
  private constructor(
    readonly value: string,
    private readonly epochDay: number,
  ) {}

  /** `YYYY-MM-DD` 形式かつ暦上存在する日付のみ受け付ける */
  static create(value: string): BusinessDate {
    const match = DATE_FORMAT.exec(value);
    if (match === null) {
      throw new InvalidBusinessDateError(`営業日は YYYY-MM-DD 形式で指定してください: "${value}"`);
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    // Date.UTC は 2/30 → 3/2 のように繰り上げるため、往復して一致するかで実在を判定する
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
      throw new InvalidBusinessDateError(`存在しない日付です: "${value}"`);
    }
    return new BusinessDate(value, utc.getTime() / MS_PER_DAY);
  }

  /** 任意の時点を JST の日付に変換する。実行環境のタイムゾーンには依存しない。 */
  static fromInstant(instant: Date): BusinessDate {
    const time = instant.getTime();
    if (Number.isNaN(time)) {
      throw new InvalidBusinessDateError('不正な日時から営業日は決定できません');
    }
    const jst = new Date(time + JST_OFFSET_MS);
    return BusinessDate.create(
      `${pad(jst.getUTCFullYear(), 4)}-${pad(jst.getUTCMonth() + 1, 2)}-${pad(jst.getUTCDate(), 2)}`,
    );
  }

  equals(other: BusinessDate): boolean {
    return this.value === other.value;
  }

  isAfter(other: BusinessDate): boolean {
    return this.epochDay > other.epochDay;
  }

  /** この日付から `other` までの日数（`other` が過去なら負数） */
  daysUntil(other: BusinessDate): number {
    return other.epochDay - this.epochDay;
  }

  toString(): string {
    return this.value;
  }
}
