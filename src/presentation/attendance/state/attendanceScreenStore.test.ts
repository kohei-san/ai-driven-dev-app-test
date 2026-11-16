import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AttendanceDto,
  AttendanceListDto,
  TodayAttendanceDto,
} from '../../../application/dto/AttendanceDto';
import {
  attendanceListDto,
  finishedAttendanceDto,
  todayDto,
  workingAttendanceDto,
} from '../../../test-utils/attendanceDtoFixtures';
import { AttendanceApiError, type AttendanceApi } from '../api/AttendanceApiClient';
import { createAttendanceScreenStore } from './attendanceScreenStore';

/**
 * 勤怠画面の状態管理（打刻実行・一覧再取得・API エラーハンドリング）。
 * React に依存しないストアとして実装し、useAttendanceScreen フックは useSyncExternalStore で購読するだけにする。
 * 業務ルールの判定（二重打刻・時刻の前後・休憩の妥当性）は行わず、API の結果をそのまま状態に反映する。
 */

/** API のテストダブル。各メソッドの戻り値をテストごとに差し替える */
function createFakeApi() {
  return {
    clockIn: vi.fn<() => Promise<AttendanceDto>>(),
    clockOut: vi.fn<(input?: { breakMinutes?: number }) => Promise<AttendanceDto>>(),
    getToday: vi.fn<() => Promise<TodayAttendanceDto>>(),
    getList: vi.fn<(query?: { from?: string; to?: string }) => Promise<AttendanceListDto>>(),
  } satisfies AttendanceApi;
}

/** 解決タイミングをテスト側で制御できる Promise */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const apiError = (code: string, message: string, status: number | null = 409) => new AttendanceApiError({ status, code, message });

describe('createAttendanceScreenStore', () => {
  let api: ReturnType<typeof createFakeApi>;

  beforeEach(() => {
    api = createFakeApi();
    api.getToday.mockResolvedValue(todayDto());
    api.getList.mockResolvedValue(attendanceListDto());
  });

  describe('初期状態', () => {
    it('データ未取得・エラーなし・休憩入力の初期値は 60', () => {
      const store = createAttendanceScreenStore({ api });

      expect(store.getState()).toEqual({
        today: null,
        list: null,
        period: { from: '', to: '' },
        breakMinutesInput: '60',
        isLoading: false,
        isSubmitting: false,
        errorMessage: null,
      });
    });
  });

  describe('load（初期表示）', () => {
    it('当日の状況と勤怠一覧を取得して状態に反映する', async () => {
      const today = todayDto({ status: 'WORKING', attendance: workingAttendanceDto() });
      const list = attendanceListDto({ items: [workingAttendanceDto()] });
      api.getToday.mockResolvedValue(today);
      api.getList.mockResolvedValue(list);
      const store = createAttendanceScreenStore({ api });

      await store.load();

      expect(store.getState().today).toEqual(today);
      expect(store.getState().list).toEqual(list);
      expect(store.getState().isLoading).toBe(false);
    });

    it('期間が未入力なら期間を指定せずに一覧を取得し、API が決めた期間を入力欄に反映する', async () => {
      api.getList.mockResolvedValue(attendanceListDto({ from: '2026-11-01', to: '2026-11-16' }));
      const store = createAttendanceScreenStore({ api });

      await store.load();

      expect(api.getList).toHaveBeenCalledWith({ from: undefined, to: undefined });
      expect(store.getState().period).toEqual({ from: '2026-11-01', to: '2026-11-16' });
    });

    it('取得中は isLoading が true になる', async () => {
      const pending = deferred<TodayAttendanceDto>();
      api.getToday.mockReturnValue(pending.promise);
      const store = createAttendanceScreenStore({ api });

      const loading = store.load();
      expect(store.getState().isLoading).toBe(true);

      pending.resolve(todayDto());
      await loading;
      expect(store.getState().isLoading).toBe(false);
    });

    it('取得に失敗したらエラーメッセージを表示する', async () => {
      api.getToday.mockRejectedValue(apiError('INTERNAL_ERROR', 'サーバー内部でエラーが発生しました', 500));
      const store = createAttendanceScreenStore({ api });

      await store.load();

      expect(store.getState().errorMessage).toBe('サーバー内部でエラーが発生しました');
      expect(store.getState().isLoading).toBe(false);
    });
  });

  describe('clockIn（出勤打刻）', () => {
    it('出勤 API を呼び出し、成功後に当日の状況と一覧を再取得する', async () => {
      const store = createAttendanceScreenStore({ api });
      await store.load();
      api.getToday.mockClear();
      api.getList.mockClear();

      const today = todayDto({ status: 'WORKING', attendance: workingAttendanceDto() });
      const list = attendanceListDto({ items: [workingAttendanceDto()] });
      api.clockIn.mockResolvedValue(workingAttendanceDto());
      api.getToday.mockResolvedValue(today);
      api.getList.mockResolvedValue(list);

      await store.clockIn();

      expect(api.clockIn).toHaveBeenCalledTimes(1);
      expect(api.getToday).toHaveBeenCalledTimes(1);
      expect(api.getList).toHaveBeenCalledTimes(1);
      expect(store.getState().today).toEqual(today);
      expect(store.getState().list).toEqual(list);
      expect(store.getState().errorMessage).toBeNull();
    });

    it('一覧の再取得は現在の期間で行う', async () => {
      api.getList.mockResolvedValue(attendanceListDto({ from: '2026-11-01', to: '2026-11-16' }));
      const store = createAttendanceScreenStore({ api });
      await store.load();
      api.getList.mockClear();
      api.clockIn.mockResolvedValue(workingAttendanceDto());

      await store.clockIn();

      expect(api.getList).toHaveBeenCalledWith({ from: '2026-11-01', to: '2026-11-16' });
    });

    it('API エラー（二重打刻: ALREADY_CLOCKED_IN）のメッセージを表示し、再取得はしない', async () => {
      const store = createAttendanceScreenStore({ api });
      await store.load();
      api.getToday.mockClear();
      api.getList.mockClear();
      api.clockIn.mockRejectedValue(apiError('ALREADY_CLOCKED_IN', '本日はすでに出勤中です'));

      await store.clockIn();

      expect(store.getState().errorMessage).toBe('本日はすでに出勤中です');
      expect(store.getState().isSubmitting).toBe(false);
      expect(api.getToday).not.toHaveBeenCalled();
      expect(api.getList).not.toHaveBeenCalled();
    });

    it('打刻中は isSubmitting が true になり、完了すると false に戻る', async () => {
      const pending = deferred<AttendanceDto>();
      api.clockIn.mockReturnValue(pending.promise);
      const store = createAttendanceScreenStore({ api });

      const submitting = store.clockIn();
      expect(store.getState().isSubmitting).toBe(true);

      pending.resolve(workingAttendanceDto());
      await submitting;
      expect(store.getState().isSubmitting).toBe(false);
    });

    it('打刻中に再度押されても API を二重に呼び出さない', async () => {
      const pending = deferred<AttendanceDto>();
      api.clockIn.mockReturnValue(pending.promise);
      const store = createAttendanceScreenStore({ api });

      const first = store.clockIn();
      const second = store.clockIn();
      pending.resolve(workingAttendanceDto());
      await Promise.all([first, second]);

      expect(api.clockIn).toHaveBeenCalledTimes(1);
    });

    it('前回のエラーメッセージは次の打刻開始時に消える', async () => {
      api.clockIn.mockRejectedValueOnce(apiError('ALREADY_CLOCKED_IN', '本日はすでに出勤中です'));
      const store = createAttendanceScreenStore({ api });
      await store.clockIn();
      expect(store.getState().errorMessage).not.toBeNull();

      api.clockIn.mockResolvedValue(workingAttendanceDto());
      await store.clockIn();

      expect(store.getState().errorMessage).toBeNull();
    });
  });

  describe('clockOut（退勤打刻）', () => {
    it('休憩入力の値を数値にして退勤 API に渡し、成功後に再取得する', async () => {
      const store = createAttendanceScreenStore({ api });
      api.clockOut.mockResolvedValue(finishedAttendanceDto());
      const today = todayDto({ status: 'FINISHED', attendance: finishedAttendanceDto() });
      api.getToday.mockResolvedValue(today);

      store.setBreakMinutesInput('45');
      await store.clockOut();

      expect(api.clockOut).toHaveBeenCalledWith({ breakMinutes: 45 });
      expect(api.getToday).toHaveBeenCalledTimes(1);
      expect(api.getList).toHaveBeenCalledTimes(1);
      expect(store.getState().today).toEqual(today);
    });

    it('休憩入力が初期値のままなら 60 分で退勤する', async () => {
      const store = createAttendanceScreenStore({ api });
      api.clockOut.mockResolvedValue(finishedAttendanceDto());

      await store.clockOut();

      expect(api.clockOut).toHaveBeenCalledWith({ breakMinutes: 60 });
    });

    it('休憩入力が空なら breakMinutes を省略する（サーバー既定の 60 分: AC-04-4）', async () => {
      const store = createAttendanceScreenStore({ api });
      api.clockOut.mockResolvedValue(finishedAttendanceDto());

      store.setBreakMinutesInput('  ');
      await store.clockOut();

      expect(api.clockOut).toHaveBeenCalledWith({ breakMinutes: undefined });
    });

    it('休憩の妥当性（負数・小数）は UI で判定せず API に委ね、返ってきたエラーを表示する（BR-04）', async () => {
      const store = createAttendanceScreenStore({ api });
      api.clockOut.mockRejectedValue(apiError('INVALID_BREAK_DURATION', '休憩時間が不正です', 400));

      store.setBreakMinutesInput('-1');
      await store.clockOut();

      expect(api.clockOut).toHaveBeenCalledWith({ breakMinutes: -1 });
      expect(store.getState().errorMessage).toBe('休憩時間が不正です');
    });

    it.each([
      ['NOT_CLOCKED_IN', '出勤中の勤怠がありません', 409],
      ['INVALID_CLOCK_OUT_TIME', '退勤時刻は出勤時刻より後である必要があります', 422],
    ])('API エラー（%s）のメッセージを表示し、再取得はしない', async (code, message, status) => {
      const store = createAttendanceScreenStore({ api });
      api.clockOut.mockRejectedValue(apiError(code, message, status));

      await store.clockOut();

      expect(store.getState().errorMessage).toBe(message);
      expect(store.getState().isSubmitting).toBe(false);
      expect(api.getToday).not.toHaveBeenCalled();
    });

    it('退勤中に再度押されても API を二重に呼び出さない', async () => {
      const pending = deferred<AttendanceDto>();
      api.clockOut.mockReturnValue(pending.promise);
      const store = createAttendanceScreenStore({ api });

      const first = store.clockOut();
      const second = store.clockOut();
      pending.resolve(finishedAttendanceDto());
      await Promise.all([first, second]);

      expect(api.clockOut).toHaveBeenCalledTimes(1);
    });

    it('退勤に成功したら休憩入力を初期値 60 に戻す', async () => {
      const store = createAttendanceScreenStore({ api });
      api.clockOut.mockResolvedValue(finishedAttendanceDto());

      store.setBreakMinutesInput('30');
      await store.clockOut();

      expect(store.getState().breakMinutesInput).toBe('60');
    });
  });

  describe('期間指定での一覧取得（search）', () => {
    it('入力された期間で一覧のみを再取得する', async () => {
      const store = createAttendanceScreenStore({ api });
      await store.load();
      api.getToday.mockClear();
      api.getList.mockClear();
      const list = attendanceListDto({ from: '2026-10-01', to: '2026-10-31', items: [finishedAttendanceDto()] });
      api.getList.mockResolvedValue(list);

      store.setPeriod({ from: '2026-10-01', to: '2026-10-31' });
      await store.search();

      expect(api.getList).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-31' });
      expect(api.getToday).not.toHaveBeenCalled();
      expect(store.getState().list).toEqual(list);
    });

    it('setPeriod は片方だけの変更もできる', () => {
      const store = createAttendanceScreenStore({ api });

      store.setPeriod({ from: '2026-11-01', to: '2026-11-16' });
      store.setPeriod({ from: '2026-10-01' });

      expect(store.getState().period).toEqual({ from: '2026-10-01', to: '2026-11-16' });
    });

    it('空欄の期間は省略として API に渡す（既定期間はサーバーが決める）', async () => {
      const store = createAttendanceScreenStore({ api });

      store.setPeriod({ from: '', to: '2026-11-16' });
      await store.search();

      expect(api.getList).toHaveBeenCalledWith({ from: undefined, to: '2026-11-16' });
    });

    it('期間の妥当性（from > to・93 日超過）は UI で判定せず、API のエラーを表示して直前の一覧を保つ', async () => {
      const previous = attendanceListDto({ items: [finishedAttendanceDto()] });
      api.getList.mockResolvedValue(previous);
      const store = createAttendanceScreenStore({ api });
      await store.load();
      api.getList.mockRejectedValue(apiError('VALIDATION_ERROR', '期間の指定が不正です', 400));

      store.setPeriod({ from: '2026-11-16', to: '2026-11-01' });
      await store.search();

      expect(api.getList).toHaveBeenLastCalledWith({ from: '2026-11-16', to: '2026-11-01' });
      expect(store.getState().errorMessage).toBe('期間の指定が不正です');
      expect(store.getState().list).toEqual(previous);
    });
  });

  describe('エラーハンドリング共通', () => {
    it('AttendanceApiError 以外の例外は汎用メッセージを表示する', async () => {
      api.clockIn.mockRejectedValue(new Error('boom'));
      const store = createAttendanceScreenStore({ api });

      await store.clockIn();

      expect(store.getState().errorMessage).toBe('予期しないエラーが発生しました');
    });

    it('打刻は成功したが再取得に失敗した場合もエラーを表示する', async () => {
      api.clockIn.mockResolvedValue(workingAttendanceDto());
      api.getToday.mockRejectedValue(apiError('NETWORK_ERROR', 'サーバーに接続できませんでした', null));
      const store = createAttendanceScreenStore({ api });

      await store.clockIn();

      expect(store.getState().errorMessage).toBe('サーバーに接続できませんでした');
      expect(store.getState().isSubmitting).toBe(false);
    });

    it('clearError でエラーメッセージを消せる', async () => {
      api.clockIn.mockRejectedValue(apiError('ALREADY_CLOCKED_IN', '本日はすでに出勤中です'));
      const store = createAttendanceScreenStore({ api });
      await store.clockIn();

      store.clearError();

      expect(store.getState().errorMessage).toBeNull();
    });
  });

  describe('購読（useSyncExternalStore 用）', () => {
    it('状態が変わると購読者に通知され、getState は新しいスナップショットを返す', () => {
      const store = createAttendanceScreenStore({ api });
      const listener = vi.fn();
      store.subscribe(listener);
      const before = store.getState();

      store.setBreakMinutesInput('30');

      expect(listener).toHaveBeenCalled();
      expect(store.getState()).not.toBe(before);
      expect(before.breakMinutesInput).toBe('60');
    });

    it('状態が変わらない間は getState が同一の参照を返す', () => {
      const store = createAttendanceScreenStore({ api });

      expect(store.getState()).toBe(store.getState());
    });

    it('購読を解除すると通知されない', () => {
      const store = createAttendanceScreenStore({ api });
      const listener = vi.fn();
      const unsubscribe = store.subscribe(listener);

      unsubscribe();
      store.setBreakMinutesInput('30');

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
