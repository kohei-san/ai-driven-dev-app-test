import type { AttendanceListDto, TodayAttendanceDto } from '../../../application/dto/AttendanceDto';
import { AttendanceApiError, type AttendanceApi, type AttendanceListQuery } from '../api/AttendanceApiClient';

/**
 * 勤怠画面の状態管理（打刻実行・一覧再取得・API エラーハンドリング）。
 * React に依存しないストアとして実装し、useAttendanceScreen が useSyncExternalStore で購読する。
 * 業務ルールの判定は行わず、API の結果（成功 / エラーメッセージ）をそのまま状態に反映する。
 */

export const DEFAULT_BREAK_MINUTES_INPUT = '60';
const UNEXPECTED_ERROR_MESSAGE = '予期しないエラーが発生しました';

export type PeriodInput = {
  /** `YYYY-MM-DD`。空文字は未指定 */
  from: string;
  to: string;
};

export type AttendanceScreenState = {
  readonly today: TodayAttendanceDto | null;
  readonly list: AttendanceListDto | null;
  /** 一覧の期間入力欄 */
  readonly period: PeriodInput;
  /** 休憩時間（分）の入力欄 */
  readonly breakMinutesInput: string;
  readonly isLoading: boolean;
  readonly isSubmitting: boolean;
  readonly errorMessage: string | null;
};

export type AttendanceScreenStore = {
  getState(): AttendanceScreenState;
  subscribe(listener: () => void): () => void;
  /** 当日の状況と一覧を取得する（初期表示） */
  load(): Promise<void>;
  /** 出勤打刻 → 成功したら再取得 */
  clockIn(): Promise<void>;
  /** 退勤打刻（休憩入力の値を送る）→ 成功したら再取得 */
  clockOut(): Promise<void>;
  /** 入力された期間で一覧のみ再取得する */
  search(): Promise<void>;
  setBreakMinutesInput(value: string): void;
  setPeriod(period: Partial<PeriodInput>): void;
  clearError(): void;
};

const INITIAL_STATE: AttendanceScreenState = {
  today: null,
  list: null,
  period: { from: '', to: '' },
  breakMinutesInput: DEFAULT_BREAK_MINUTES_INPUT,
  isLoading: false,
  isSubmitting: false,
  errorMessage: null,
};

const toErrorMessage = (error: unknown): string =>
  error instanceof AttendanceApiError ? error.message : UNEXPECTED_ERROR_MESSAGE;

const blankToUndefined = (value: string): string | undefined => (value.trim() === '' ? undefined : value.trim());

/** 休憩入力 → API に送る値。空欄は省略（サーバー既定）。数値の妥当性はサーバーが判定する */
const toBreakMinutes = (input: string): number | undefined =>
  input.trim() === '' ? undefined : Number(input.trim());

export function createAttendanceScreenStore({ api }: { api: AttendanceApi }): AttendanceScreenStore {
  let state = INITIAL_STATE;
  const listeners = new Set<() => void>();

  const setState = (patch: Partial<AttendanceScreenState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  const currentQuery = (): AttendanceListQuery => ({
    from: blankToUndefined(state.period.from),
    to: blankToUndefined(state.period.to),
  });

  /** 一覧を反映し、API が確定した期間を入力欄に戻す */
  const applyList = (list: AttendanceListDto) => setState({ list, period: { from: list.from, to: list.to } });

  /** 当日の状況と一覧を取得する。失敗は呼び出し元で扱う */
  const refresh = async () => {
    const [today, list] = await Promise.all([api.getToday(), api.getList(currentQuery())]);
    setState({ today });
    applyList(list);
  };

  /** 打刻系の共通処理: 二重送信の防止・エラー表示・成功後の再取得 */
  const submit = async (action: () => Promise<void>) => {
    if (state.isSubmitting) {
      return;
    }
    setState({ isSubmitting: true, errorMessage: null });
    try {
      await action();
      await refresh();
    } catch (error) {
      setState({ errorMessage: toErrorMessage(error) });
    } finally {
      setState({ isSubmitting: false });
    }
  };

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    async load() {
      setState({ isLoading: true });
      try {
        await refresh();
      } catch (error) {
        setState({ errorMessage: toErrorMessage(error) });
      } finally {
        setState({ isLoading: false });
      }
    },

    clockIn: () =>
      submit(async () => {
        await api.clockIn();
      }),

    clockOut: () =>
      submit(async () => {
        await api.clockOut({ breakMinutes: toBreakMinutes(state.breakMinutesInput) });
        setState({ breakMinutesInput: DEFAULT_BREAK_MINUTES_INPUT });
      }),

    async search() {
      setState({ isLoading: true, errorMessage: null });
      try {
        applyList(await api.getList(currentQuery()));
      } catch (error) {
        setState({ errorMessage: toErrorMessage(error) });
      } finally {
        setState({ isLoading: false });
      }
    },

    setBreakMinutesInput: (value) => setState({ breakMinutesInput: value }),

    setPeriod: (period) => setState({ period: { ...state.period, ...period } }),

    clearError: () => setState({ errorMessage: null }),
  };
}
