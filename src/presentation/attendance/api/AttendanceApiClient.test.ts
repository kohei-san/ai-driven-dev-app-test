import { describe, expect, it, vi } from 'vitest';
import {
  attendanceListDto,
  finishedAttendanceDto,
  todayDto,
  workingAttendanceDto,
} from '../../../test-utils/attendanceDtoFixtures';
import { AttendanceApiError, createAttendanceApiClient } from './AttendanceApiClient';

/**
 * 勤怠 API クライアント（presentation 層）。
 * HTTP 通信の組み立てとレスポンス / エラーの解釈だけを担い、業務ルールの判定は行わない。
 */

type FetchArgs = { url: string; init: RequestInit | undefined };

/** 指定のレスポンスを返す fetch のスタブ。呼び出し内容を記録する */
function stubFetch(response: Response | (() => Promise<Response>)) {
  const calls: FetchArgs[] = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return typeof response === 'function' ? response() : response.clone();
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const headerOf = (init: RequestInit | undefined, name: string) => new Headers(init?.headers).get(name);

describe('createAttendanceApiClient', () => {
  describe('clockIn（F-01）', () => {
    it('POST /api/attendances/clock-in をボディなしで呼び出し、AttendanceDto を返す', async () => {
      const dto = workingAttendanceDto();
      const { fetchFn, calls } = stubFetch(json(dto, 201));
      const client = createAttendanceApiClient({ fetch: fetchFn });

      await expect(client.clockIn()).resolves.toEqual(dto);
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe('/api/attendances/clock-in');
      expect(calls[0].init?.method).toBe('POST');
      expect(calls[0].init?.body).toBeUndefined();
    });
  });

  describe('clockOut（F-02）', () => {
    it('POST /api/attendances/clock-out に breakMinutes を JSON で送る', async () => {
      const dto = finishedAttendanceDto();
      const { fetchFn, calls } = stubFetch(json(dto));
      const client = createAttendanceApiClient({ fetch: fetchFn });

      await expect(client.clockOut({ breakMinutes: 45 })).resolves.toEqual(dto);
      expect(calls[0].url).toBe('/api/attendances/clock-out');
      expect(calls[0].init?.method).toBe('POST');
      expect(headerOf(calls[0].init, 'content-type')).toBe('application/json');
      expect(JSON.parse(String(calls[0].init?.body))).toEqual({ breakMinutes: 45 });
    });

    it('breakMinutes を省略したときはボディに含めない（既定値はサーバー側で決まる）', async () => {
      const { fetchFn, calls } = stubFetch(json(finishedAttendanceDto()));
      const client = createAttendanceApiClient({ fetch: fetchFn });

      await client.clockOut({});
      await client.clockOut();

      expect(JSON.parse(String(calls[0].init?.body))).toEqual({});
      expect(JSON.parse(String(calls[1].init?.body))).toEqual({});
    });

    it('breakMinutes の値はクライアントで検証せずそのまま送る（判定はドメイン層）', async () => {
      const { fetchFn, calls } = stubFetch(json(finishedAttendanceDto()));
      const client = createAttendanceApiClient({ fetch: fetchFn });

      await client.clockOut({ breakMinutes: -1 });

      expect(JSON.parse(String(calls[0].init?.body))).toEqual({ breakMinutes: -1 });
    });
  });

  describe('getToday（F-03）', () => {
    it('GET /api/attendances/today を呼び出し、TodayAttendanceDto を返す', async () => {
      const dto = todayDto({ status: 'WORKING', attendance: workingAttendanceDto() });
      const { fetchFn, calls } = stubFetch(json(dto));
      const client = createAttendanceApiClient({ fetch: fetchFn });

      await expect(client.getToday()).resolves.toEqual(dto);
      expect(calls[0].url).toBe('/api/attendances/today');
      expect(calls[0].init?.method ?? 'GET').toBe('GET');
    });
  });

  describe('getList（F-04）', () => {
    it('期間を指定すると from / to をクエリに付けて GET する', async () => {
      const dto = attendanceListDto({ items: [finishedAttendanceDto()] });
      const { fetchFn, calls } = stubFetch(json(dto));
      const client = createAttendanceApiClient({ fetch: fetchFn });

      await expect(client.getList({ from: '2026-11-01', to: '2026-11-16' })).resolves.toEqual(dto);
      expect(calls[0].url).toBe('/api/attendances?from=2026-11-01&to=2026-11-16');
    });

    it('期間を省略したとき・空文字のときはクエリを付けない（既定の期間はサーバー側で決まる）', async () => {
      const { fetchFn, calls } = stubFetch(json(attendanceListDto()));
      const client = createAttendanceApiClient({ fetch: fetchFn });

      await client.getList();
      await client.getList({ from: '', to: '' });
      await client.getList({ to: '2026-11-16' });

      expect(calls[0].url).toBe('/api/attendances');
      expect(calls[1].url).toBe('/api/attendances');
      expect(calls[2].url).toBe('/api/attendances?to=2026-11-16');
    });

    it('クエリの値は URL エンコードする', async () => {
      const { fetchFn, calls } = stubFetch(json(attendanceListDto()));
      const client = createAttendanceApiClient({ fetch: fetchFn });

      await client.getList({ from: '2026/11/01&x=1' });

      expect(calls[0].url).toBe('/api/attendances?from=2026%2F11%2F01%26x%3D1');
    });
  });

  describe('共通設定', () => {
    it('employeeId を指定すると x-employee-id ヘッダを付ける（BR-05）', async () => {
      const { fetchFn, calls } = stubFetch(json(todayDto()));
      const client = createAttendanceApiClient({ fetch: fetchFn, employeeId: 'emp-002' });

      await client.getToday();

      expect(headerOf(calls[0].init, 'x-employee-id')).toBe('emp-002');
    });

    it('employeeId を省略すると x-employee-id ヘッダを付けない（サーバー既定の emp-001 として扱われる）', async () => {
      const { fetchFn, calls } = stubFetch(json(todayDto()));
      const client = createAttendanceApiClient({ fetch: fetchFn });

      await client.getToday();

      expect(headerOf(calls[0].init, 'x-employee-id')).toBeNull();
    });

    it('baseUrl を差し替えられる', async () => {
      const { fetchFn, calls } = stubFetch(json(todayDto()));
      const client = createAttendanceApiClient({ fetch: fetchFn, baseUrl: 'http://localhost:3000/api/attendances' });

      await client.getToday();

      expect(calls[0].url).toBe('http://localhost:3000/api/attendances/today');
    });
  });

  describe('エラーハンドリング', () => {
    it.each([
      [409, 'ALREADY_CLOCKED_IN', '本日はすでに出勤中です'],
      [409, 'NOT_CLOCKED_IN', '出勤中の勤怠がありません'],
      [400, 'INVALID_BREAK_DURATION', '休憩時間が不正です'],
      [422, 'INVALID_CLOCK_OUT_TIME', '退勤時刻は出勤時刻より後である必要があります'],
      [400, 'VALIDATION_ERROR', '営業日の形式が不正です'],
      [500, 'INTERNAL_ERROR', 'サーバー内部でエラーが発生しました'],
    ])('HTTP %i（%s）は API のコード・メッセージを持つ AttendanceApiError を投げる', async (status, code, message) => {
      const { fetchFn } = stubFetch(json({ error: { code, message } }, status));
      const client = createAttendanceApiClient({ fetch: fetchFn });

      const error = await client.clockIn().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AttendanceApiError);
      expect(error).toMatchObject({ status, code, message });
    });

    it('エラーボディが規定の形式でない場合は UNKNOWN_ERROR として扱う', async () => {
      const { fetchFn } = stubFetch(new Response('<html>Bad Gateway</html>', { status: 502 }));
      const client = createAttendanceApiClient({ fetch: fetchFn });

      const error = await client.getToday().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AttendanceApiError);
      expect(error).toMatchObject({ status: 502, code: 'UNKNOWN_ERROR' });
      expect((error as AttendanceApiError).message).not.toBe('');
    });

    it('通信自体に失敗した場合は NETWORK_ERROR（status: null）として扱う', async () => {
      const fetchFn = vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }) as unknown as typeof fetch;
      const client = createAttendanceApiClient({ fetch: fetchFn });

      const error = await client.getList().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AttendanceApiError);
      expect(error).toMatchObject({ status: null, code: 'NETWORK_ERROR' });
      expect((error as AttendanceApiError).message).not.toBe('');
    });

    it('成功ステータスでもボディが JSON でなければ UNKNOWN_ERROR として扱う', async () => {
      const { fetchFn } = stubFetch(new Response('not json', { status: 200 }));
      const client = createAttendanceApiClient({ fetch: fetchFn });

      const error = await client.getToday().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AttendanceApiError);
      expect(error).toMatchObject({ code: 'UNKNOWN_ERROR' });
    });
  });
});
