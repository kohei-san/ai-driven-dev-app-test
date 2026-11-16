import type {
  AttendanceDto,
  AttendanceListDto,
  TodayAttendanceDto,
} from '../../../application/dto/AttendanceDto';

/**
 * 勤怠 API（/api/attendances）のクライアント。
 * HTTP 通信の組み立てとレスポンス / エラーの解釈だけを担い、業務ルールの判定は行わない
 * （休憩時間や期間の妥当性はサーバー側のドメイン層が判定する）。
 */

export type ClockOutRequest = {
  /** 省略時はサーバー既定の 60 分 */
  readonly breakMinutes?: number;
};

export type AttendanceListQuery = {
  /** 省略・空文字はサーバー既定（`to` の月の 1 日） */
  readonly from?: string;
  /** 省略・空文字はサーバー既定（本日） */
  readonly to?: string;
};

export type AttendanceApi = {
  /** POST /clock-in（F-01） */
  clockIn(): Promise<AttendanceDto>;
  /** POST /clock-out（F-02） */
  clockOut(request?: ClockOutRequest): Promise<AttendanceDto>;
  /** GET /today（F-03） */
  getToday(): Promise<TodayAttendanceDto>;
  /** GET /（F-04） */
  getList(query?: AttendanceListQuery): Promise<AttendanceListDto>;
};

/** API 呼び出しの失敗。`code` / `message` はサーバーのエラーレスポンスをそのまま保持する */
export class AttendanceApiError extends Error {
  /** HTTP ステータス。通信自体に失敗した場合は null */
  readonly status: number | null;
  /** サーバーのエラーコード（例: `ALREADY_CLOCKED_IN`）、または `NETWORK_ERROR` / `UNKNOWN_ERROR` */
  readonly code: string;

  constructor({ status, code, message }: { status: number | null; code: string; message: string }) {
    super(message);
    this.name = 'AttendanceApiError';
    this.status = status;
    this.code = code;
  }
}

export type AttendanceApiClientOptions = {
  /** テスト用に差し替え可能な fetch。省略時は globalThis.fetch */
  readonly fetch?: typeof fetch;
  /** 省略時は `/api/attendances` */
  readonly baseUrl?: string;
  /** 指定時は `x-employee-id` ヘッダとして送る（BR-05）。省略時はサーバー既定の従業員 */
  readonly employeeId?: string;
};

const EMPLOYEE_ID_HEADER = 'x-employee-id';
const NOT_PARSED = Symbol('NOT_PARSED');

type ErrorBody = { error: { code: string; message: string } };

const isErrorBody = (value: unknown): value is ErrorBody => {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }
  const { error } = value;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  );
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return NOT_PARSED;
  }
}

export function createAttendanceApiClient(options: AttendanceApiClientOptions = {}): AttendanceApi {
  const {
    // ブラウザでは window 以外をレシーバにすると Illegal invocation になるため、関数で包む
    fetch: fetchFn = (input, init) => globalThis.fetch(input, init),
    baseUrl = '/api/attendances',
    employeeId,
  } = options;

  async function request<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers);
    if (employeeId !== undefined) {
      headers.set(EMPLOYEE_ID_HEADER, employeeId);
    }

    let response: Response;
    try {
      response = await fetchFn(`${baseUrl}${path}`, { ...init, headers });
    } catch {
      throw new AttendanceApiError({
        status: null,
        code: 'NETWORK_ERROR',
        message: 'サーバーに接続できませんでした。通信環境を確認してください',
      });
    }

    const body = parseJson(await response.text());

    if (!response.ok) {
      if (isErrorBody(body)) {
        throw new AttendanceApiError({ status: response.status, ...body.error });
      }
      throw new AttendanceApiError({
        status: response.status,
        code: 'UNKNOWN_ERROR',
        message: `サーバーとの通信でエラーが発生しました（HTTP ${response.status}）`,
      });
    }

    if (body === NOT_PARSED) {
      throw new AttendanceApiError({
        status: response.status,
        code: 'UNKNOWN_ERROR',
        message: 'サーバーから不正な応答が返されました',
      });
    }
    // レスポンスの型はサーバー（application 層の DTO）と共有している
    return body as T;
  }

  return {
    clockIn: () => request<AttendanceDto>('/clock-in', { method: 'POST' }),

    clockOut: ({ breakMinutes }: ClockOutRequest = {}) =>
      request<AttendanceDto>('/clock-out', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(breakMinutes === undefined ? {} : { breakMinutes }),
      }),

    getToday: () => request<TodayAttendanceDto>('/today', { method: 'GET' }),

    getList: ({ from, to }: AttendanceListQuery = {}) => {
      const params = new URLSearchParams();
      if (from !== undefined && from !== '') params.set('from', from);
      if (to !== undefined && to !== '') params.set('to', to);
      const query = params.toString();
      return request<AttendanceListDto>(query === '' ? '' : `?${query}`, { method: 'GET' });
    },
  };
}
