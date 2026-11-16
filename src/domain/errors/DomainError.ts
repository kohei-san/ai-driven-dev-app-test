/**
 * ドメイン例外の基底クラス。
 *
 * - `code` は機械可読なエラーコード。HTTP ステータスへの変換は app 層が `code` を見て行う。
 * - ドメイン層は HTTP やフレームワークを知らない。
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
