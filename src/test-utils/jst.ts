/**
 * テスト専用ヘルパー: JST のローカル日時文字列から Date を生成する。
 * 実行環境のタイムゾーンに依存せずテストを書くために使う。
 *
 * @example jst('2026-11-16T09:00')        // 2026-11-16 09:00:00 JST
 * @example jst('2026-11-16T18:00:59.999') // 秒・ミリ秒も指定可
 */
export function jst(local: string): Date {
  const withSeconds = /T\d{2}:\d{2}$/.test(local) ? `${local}:00` : local;
  const date = new Date(`${withSeconds}+09:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`jst(): 不正な日時文字列です: ${local}`);
  }
  return date;
}
