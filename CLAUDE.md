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
```

### 依存の方向性（違反厳禁）
依存は必ず **外側 → 内側（`presentation` / `infrastructure` → `application` → `domain`）** の一方向のみ許可する。

1. **`domain` 層の純粋性:**
   * `domain` 層は他のどの層（`application`, `infrastructure`, `presentation`, `app`）も import してはならない。
   * Next.js や Prisma などのフレームワーク・外部ライブラリに一切依存せず、純粋な TypeScript のみで記述すること。
2. **`application` 層の責務:**
   * `domain` 層のみに依存する。永続化処理は `domain` 層で定義したリポジトリインターフェース経由で呼び出し、`infrastructure` 層の具体クラスを直接 import してはならない。
3. **`infrastructure` 層の責務:**
   * `domain` 層のリポジトリインターフェースを実装（`implements`）する。
4. **`presentation` / `app` 層の責務:**
   * `application` 層のユースケースを呼び出す。ドメインロジック（時刻計算やステータス判定など）をコンポーネントや API Route に直接書いてはならない。

---

## 3. 勤怠管理のドメインルール（不変条件）

ドメインモデルの実装時は、以下のビジネスルールを値オブジェクト・エンティティ・ドメインサービス内にカプセル化すること。

1. **時刻の整合性:** 退勤時刻（`ClockOutTime`）は出勤時刻（`ClockInTime`）より後でなければならない。
2. **二重打刻の防止:** 同一従業員・同一営業日において、すでに「出勤中（未退勤）」の勤怠レコードが存在する場合、新規の出勤打刻は許可しない。
3. **実働時間と残業計算:**
   * 実働時間 ＝（退勤時刻 − 出勤時刻）− 休憩時間。
   * 所定労働時間（8時間＝480分）を超過した分を残業時間として算出する。
4. **認証スコープ（仮置き方針）:**
   * 初期フェーズでは認証基盤を作り込まず、固定のテスト従業員ID（例: `emp-001`）またはリクエストヘッダ `x-employee-id` をログイン済みユーザーとして扱う。

---

## 4. 開発ワークフローとコーディング規約

タスクや Issue の実装を依頼された際は、必ず以下の手順（TDDアプローチ）で進めること。

1. **設計確認:** 変更対象がどの層（`domain` / `application` / `infrastructure` / `presentation`）に属するかを整理する。
2. **テスト先行（Red）:** 実装コードを書く前に、`domain` 層のビジネスルールおよび `application` 層のユースケースに対する Vitest テスト（`*.test.ts`）を作成し、失敗することを確認する。
3. **最小限の実装（Green）:** テストを通すための実装を行う。
4. **品質チェック:** 完了報告の前に必ず以下を実行し、すべてエラーゼロであることを確認する。
   * `npx tsc --noEmit`（型エラーがないこと）
   * `npm run arch:check`（DDDの層違反・依存関係エラーがないこと）
   * `npx vitest run`（全テストがパスすること）
   * `npm run lint`（Lintエラーがないこと）
5. **命名規則:**
   * 値オブジェクト: `ClockInTime.ts`, `WorkDuration.ts`（不変オブジェクトとして設計し、生成時にバリデーションを行う）
   * エンティティ: `Attendance.ts`
   * リポジトリIF: `IAttendanceRepository.ts`（`domain` 層に配置）
   * リポジトリ実装: `InMemoryAttendanceRepository.ts` / `PrismaAttendanceRepository.ts`（`infrastructure` 層に配置）
   * ユースケース: `ClockInUseCase.ts`, `ClockOutUseCase.ts`（`application` 層に配置）