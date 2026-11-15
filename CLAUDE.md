# CLAUDE.md - プロジェクト開発ガイドライン

本リポジトリは、AI駆動開発（AIDD）およびドメイン駆動設計（DDD）を実践する「勤怠管理システム（Attendance Management System）」である。
Claude Code はすべての実装・テスト・レビューにおいて、本ファイルのルールを厳格に遵守すること。

---

## 1. 技術スタック・コマンド

* **言語:** TypeScript (strict モード必須、`any` 禁止)
* **フレームワーク:** Next.js (App Router)
* **テストランナー:** Vitest
* **アーキテクチャ:** レイヤードアーキテクチャ + DDD（ドメイン駆動設計）

### よく使うコマンド
* 開発サーバー起動: `npm run dev`
* 型チェック: `npx tsc --noEmit`
* Lint実行: `npm run lint`
* 単体・結合テスト実行: `npx vitest run`

---

## 2. ディレクトリ構成とDDD依存関係ルール（最重要）

```text
src/
├── app/             # Next.js App Router（ルーティング・APIエンドポイント）
├── domain/          # ドメイン層（エンティティ、値オブジェクト、リポジトリIF、ドメインサービス）
├── application/     # アプリケーション層（ユースケース、DTO）
├── infrastructure/  # インフラ層（リポジトリ実装、DB/メモリ永続化、外部API）
└── presentation/    # プレゼンテーション層（UIコンポーネント、バリデーションスキーマ）