/**
 * 時計（アプリケーション層のポート）。
 * 「今」を決めるのはシステムの関心事のため、ドメインは時刻を引数で受け取るだけにし、
 * ユースケースがこのポートから現在時刻を取得して渡す。
 * 実装: infrastructure/clock/SystemClock（本番）、test-utils/FixedClock（テスト）
 */
export interface IClock {
  now(): Date;
}
