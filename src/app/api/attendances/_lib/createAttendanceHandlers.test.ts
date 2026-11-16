import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAttendanceHandlers, type AttendanceHandlers } from './createAttendanceHandlers';
import type { AttendanceDto, AttendanceListDto, TodayAttendanceDto } from '../../../../application/dto/AttendanceDto';
import type { Attendance } from '../../../../domain/models/attendance/Attendance';
import { InvalidAttendanceStateError } from '../../../../domain/errors';
import { InMemoryAttendanceRepository } from '../../../../infrastructure/repositories/InMemoryAttendanceRepository';
import { FixedClock } from '../../../../test-utils/FixedClock';
import { jst } from '../../../../test-utils/jst';

// ---- リクエスト・レスポンスのヘルパー ----
const BASE_URL = 'http://localhost/api/attendances';

type RequestOptions = {
  /** `x-employee-id` ヘッダ。省略時はヘッダを付けない */
  employeeId?: string;
  /** JSON としてシリアライズするボディ */
  body?: unknown;
  /** そのまま送るボディ（不正な JSON の検証用） */
  rawBody?: string;
  query?: Record<string, string>;
};

function buildRequest(method: 'GET' | 'POST', path: string, options: RequestOptions = {}): Request {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value);
  }
  const headers = new Headers();
  if (options.employeeId !== undefined) {
    headers.set('x-employee-id', options.employeeId);
  }
  let body: string | undefined;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
  }
  if (body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  return new Request(url, { method, headers, body });
}

const post = (path: string, options?: RequestOptions) => buildRequest('POST', path, options);
const get = (path: string, options?: RequestOptions) => buildRequest('GET', path, options);

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

type ErrorBody = { error: { code: string; message: string } };

async function expectError(response: Response, status: number, code: string): Promise<ErrorBody> {
  expect(response.status).toBe(status);
  expect(response.headers.get('content-type')).toContain('application/json');
  const body = await readJson<ErrorBody>(response);
  expect(body.error.code).toBe(code);
  expect(typeof body.error.message).toBe('string');
  expect(body.error.message.length).toBeGreaterThan(0);
  return body;
}

describe('勤怠 API（/api/attendances）', () => {
  let repository: InMemoryAttendanceRepository;
  let clock: FixedClock;
  let api: AttendanceHandlers;

  beforeEach(() => {
    repository = new InMemoryAttendanceRepository();
    clock = new FixedClock(jst('2026-11-16T09:00'));
    api = createAttendanceHandlers({ attendanceRepository: repository, clock });
  });

  // =========================================================
  describe('POST /api/attendances/clock-in（F-01）', () => {
    it('201 Created と AttendanceDto を返す', async () => {
      const response = await api.clockIn(post('/clock-in', { employeeId: 'emp-001' }));

      expect(response.status).toBe(201);
      expect(response.headers.get('content-type')).toContain('application/json');
      const body = await readJson<AttendanceDto>(response);
      expect(body).toEqual({
        id: expect.any(String),
        employeeId: 'emp-001',
        businessDate: '2026-11-16',
        clockInAt: '2026-11-16T09:00:00+09:00',
        clockOutAt: null,
        breakMinutes: null,
        workMinutes: null,
        overtimeMinutes: null,
        status: 'WORKING',
      });
      expect(body.id.length).toBeGreaterThan(0);
    });

    it('リクエストボディは不要（送られても無視する）', async () => {
      const response = await api.clockIn(post('/clock-in', { employeeId: 'emp-001', body: { clockInAt: '2000-01-01T00:00:00+09:00' } }));

      expect(response.status).toBe(201);
      // P-2: 打刻時刻はクライアントの値ではなくサーバーの現在時刻
      expect((await readJson<AttendanceDto>(response)).clockInAt).toBe('2026-11-16T09:00:00+09:00');
    });

    it('AC-02-2: 同一営業日に出勤中なら 409 ALREADY_CLOCKED_IN', async () => {
      await api.clockIn(post('/clock-in', { employeeId: 'emp-001' }));
      clock.set(jst('2026-11-16T09:30'));

      await expectError(await api.clockIn(post('/clock-in', { employeeId: 'emp-001' })), 409, 'ALREADY_CLOCKED_IN');
    });

    it('AC-02-3: 退勤後の再出勤は 201', async () => {
      await api.clockIn(post('/clock-in', { employeeId: 'emp-001' }));
      clock.set(jst('2026-11-16T12:00'));
      await api.clockOut(post('/clock-out', { employeeId: 'emp-001', body: { breakMinutes: 0 } }));
      clock.set(jst('2026-11-16T13:00'));

      expect((await api.clockIn(post('/clock-in', { employeeId: 'emp-001' }))).status).toBe(201);
    });
  });

  // =========================================================
  describe('x-employee-id ヘッダの扱い（BR-05）', () => {
    it('AC-05-1: ヘッダの従業員IDで処理される', async () => {
      const response = await api.clockIn(post('/clock-in', { employeeId: 'emp-002' }));
      expect((await readJson<AttendanceDto>(response)).employeeId).toBe('emp-002');
    });

    it('AC-05-2: ヘッダがなければ既定の emp-001 として処理される', async () => {
      const response = await api.clockIn(post('/clock-in'));
      expect((await readJson<AttendanceDto>(response)).employeeId).toBe('emp-001');
    });

    it.each([
      ['空文字', ''],
      ['空白のみ', '   '],
    ])('AC-05-3: ヘッダが%sなら emp-001 として処理される', async (_label, employeeId) => {
      const response = await api.clockIn(post('/clock-in', { employeeId }));
      expect(response.status).toBe(201);
      expect((await readJson<AttendanceDto>(response)).employeeId).toBe('emp-001');
    });

    it.each([
      ['65 文字', 'a'.repeat(65)],
      ['使用できない記号を含む', 'emp@001'],
      ['途中に空白を含む', 'emp 001'],
    ])('AC-05-4: ヘッダが%sなら 400 VALIDATION_ERROR', async (_label, employeeId) => {
      await expectError(await api.clockIn(post('/clock-in', { employeeId })), 400, 'VALIDATION_ERROR');
    });

    it('従業員ごとに勤怠が独立している（AC-02-4）', async () => {
      await api.clockIn(post('/clock-in', { employeeId: 'emp-001' }));

      expect((await api.clockIn(post('/clock-in', { employeeId: 'emp-002' }))).status).toBe(201);
      await expectError(await api.clockOut(post('/clock-out', { employeeId: 'emp-003' })), 409, 'NOT_CLOCKED_IN');
    });

    it('すべてのエンドポイントで不正なヘッダは 400 VALIDATION_ERROR', async () => {
      const employeeId = 'emp@001';
      await expectError(await api.clockOut(post('/clock-out', { employeeId })), 400, 'VALIDATION_ERROR');
      await expectError(await api.getToday(get('/today', { employeeId })), 400, 'VALIDATION_ERROR');
      await expectError(await api.getList(get('', { employeeId })), 400, 'VALIDATION_ERROR');
    });
  });

  // =========================================================
  describe('POST /api/attendances/clock-out（F-02）', () => {
    beforeEach(async () => {
      await api.clockIn(post('/clock-in', { employeeId: 'emp-001' })); // 09:00 出勤
    });

    it('200 OK と実働・残業を含む AttendanceDto を返す（AC-03-2）', async () => {
      clock.set(jst('2026-11-16T20:30'));

      const response = await api.clockOut(post('/clock-out', { employeeId: 'emp-001', body: { breakMinutes: 60 } }));

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(await readJson<AttendanceDto>(response)).toEqual({
        id: expect.any(String),
        employeeId: 'emp-001',
        businessDate: '2026-11-16',
        clockInAt: '2026-11-16T09:00:00+09:00',
        clockOutAt: '2026-11-16T20:30:00+09:00',
        breakMinutes: 60,
        workMinutes: 630,
        overtimeMinutes: 150,
        status: 'FINISHED',
      });
    });

    it.each([
      ['ボディなし', {}],
      ['空オブジェクト', { body: {} }],
    ] as const)('AC-04-4: %s なら休憩 60 分として計算される', async (_label, options) => {
      clock.set(jst('2026-11-16T18:00'));

      const response = await api.clockOut(post('/clock-out', { employeeId: 'emp-001', ...options }));

      expect(response.status).toBe(200);
      const body = await readJson<AttendanceDto>(response);
      expect(body.breakMinutes).toBe(60);
      expect(body.workMinutes).toBe(480);
    });

    it('AC-02-5: 出勤中の勤怠がなければ 409 NOT_CLOCKED_IN', async () => {
      await expectError(
        await api.clockOut(post('/clock-out', { employeeId: 'emp-002', body: { breakMinutes: 60 } })),
        409,
        'NOT_CLOCKED_IN',
      );
    });

    it('退勤済の状態で再度退勤すると 409 NOT_CLOCKED_IN', async () => {
      clock.set(jst('2026-11-16T18:00'));
      await api.clockOut(post('/clock-out', { employeeId: 'emp-001', body: { breakMinutes: 60 } }));
      clock.set(jst('2026-11-16T19:00'));

      await expectError(
        await api.clockOut(post('/clock-out', { employeeId: 'emp-001', body: { breakMinutes: 60 } })),
        409,
        'NOT_CLOCKED_IN',
      );
    });

    it('AC-01-2: 出勤と同時刻の退勤は 422 INVALID_CLOCK_OUT_TIME', async () => {
      clock.set(jst('2026-11-16T09:00'));

      await expectError(
        await api.clockOut(post('/clock-out', { employeeId: 'emp-001', body: { breakMinutes: 0 } })),
        422,
        'INVALID_CLOCK_OUT_TIME',
      );
    });

    it('AC-01-3: 出勤より前の時刻での退勤は 422 INVALID_CLOCK_OUT_TIME', async () => {
      clock.set(jst('2026-11-16T08:59'));

      await expectError(
        await api.clockOut(post('/clock-out', { employeeId: 'emp-001', body: { breakMinutes: 0 } })),
        422,
        'INVALID_CLOCK_OUT_TIME',
      );
    });

    it.each([
      ['AC-04-1: 負の値', -1],
      ['AC-04-2: 小数', 30.5],
    ])('%s の休憩時間は 400 INVALID_BREAK_DURATION', async (_label, breakMinutes) => {
      clock.set(jst('2026-11-16T18:00'));

      await expectError(
        await api.clockOut(post('/clock-out', { employeeId: 'emp-001', body: { breakMinutes } })),
        400,
        'INVALID_BREAK_DURATION',
      );
    });

    it('AC-04-3: 休憩が拘束時間以上なら 400 INVALID_BREAK_DURATION', async () => {
      clock.set(jst('2026-11-16T10:00'));

      await expectError(
        await api.clockOut(post('/clock-out', { employeeId: 'emp-001', body: { breakMinutes: 60 } })),
        400,
        'INVALID_BREAK_DURATION',
      );
    });

    it.each([
      ['breakMinutes が文字列', { body: { breakMinutes: '60' } }],
      ['breakMinutes が null', { body: { breakMinutes: null } }],
      ['ボディが配列', { body: [60] }],
      ['ボディが数値', { body: 60 }],
      ['ボディが不正な JSON', { rawBody: '{ "breakMinutes": ' }],
    ] as const)('%s なら 400 VALIDATION_ERROR', async (_label, options) => {
      clock.set(jst('2026-11-16T18:00'));

      await expectError(await api.clockOut(post('/clock-out', { employeeId: 'emp-001', ...options })), 400, 'VALIDATION_ERROR');
    });

    it('エラー時は勤怠が出勤中のまま変更されない', async () => {
      clock.set(jst('2026-11-16T09:00'));
      await api.clockOut(post('/clock-out', { employeeId: 'emp-001', body: { breakMinutes: 0 } }));

      const today = await readJson<TodayAttendanceDto>(await api.getToday(get('/today', { employeeId: 'emp-001' })));
      expect(today.status).toBe('WORKING');
    });
  });

  // =========================================================
  describe('GET /api/attendances/today（F-03）', () => {
    it('未出勤なら 200 と NOT_STARTED', async () => {
      const response = await api.getToday(get('/today', { employeeId: 'emp-001' }));

      expect(response.status).toBe(200);
      expect(await readJson<TodayAttendanceDto>(response)).toEqual({
        businessDate: '2026-11-16',
        status: 'NOT_STARTED',
        attendance: null,
      });
    });

    it('出勤中なら WORKING と勤怠を返す', async () => {
      await api.clockIn(post('/clock-in', { employeeId: 'emp-001' }));

      const body = await readJson<TodayAttendanceDto>(await api.getToday(get('/today', { employeeId: 'emp-001' })));

      expect(body.status).toBe('WORKING');
      expect(body.attendance).toMatchObject({ employeeId: 'emp-001', clockInAt: '2026-11-16T09:00:00+09:00' });
    });

    it('退勤済なら FINISHED と勤怠を返す', async () => {
      await api.clockIn(post('/clock-in', { employeeId: 'emp-001' }));
      clock.set(jst('2026-11-16T18:00'));
      await api.clockOut(post('/clock-out', { employeeId: 'emp-001' }));

      const body = await readJson<TodayAttendanceDto>(await api.getToday(get('/today', { employeeId: 'emp-001' })));

      expect(body.status).toBe('FINISHED');
      expect(body.attendance?.workMinutes).toBe(480);
    });

    it('ヘッダなしなら emp-001 の状況を返す', async () => {
      await api.clockIn(post('/clock-in', { employeeId: 'emp-001' }));

      const body = await readJson<TodayAttendanceDto>(await api.getToday(get('/today')));

      expect(body.status).toBe('WORKING');
    });
  });

  // =========================================================
  describe('GET /api/attendances（F-04）', () => {
    /** 11/13・11/14 に勤務した状態を API 経由で作る */
    beforeEach(async () => {
      const work = async (clockIn: string, clockOut: string) => {
        clock.set(jst(clockIn));
        await api.clockIn(post('/clock-in', { employeeId: 'emp-001' }));
        clock.set(jst(clockOut));
        await api.clockOut(post('/clock-out', { employeeId: 'emp-001', body: { breakMinutes: 60 } }));
      };
      await work('2026-10-31T09:00', '2026-10-31T18:00'); // 480 / 0（既定期間の外）
      await work('2026-11-13T08:55', '2026-11-13T18:00'); // 485 / 5
      await work('2026-11-14T09:00', '2026-11-14T20:30'); // 630 / 150
      clock.set(jst('2026-11-16T14:32'));
    });

    it('クエリ省略時は 200 と当月 1 日〜本日の AttendanceListDto を返す', async () => {
      const response = await api.getList(get('', { employeeId: 'emp-001' }));

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      const body = await readJson<AttendanceListDto>(response);
      expect(body.from).toBe('2026-11-01');
      expect(body.to).toBe('2026-11-16');
      expect(body.items.map((item) => item.businessDate)).toEqual(['2026-11-14', '2026-11-13']);
      expect(body.totalWorkMinutes).toBe(1115);
      expect(body.totalOvertimeMinutes).toBe(155);
    });

    it('from・to クエリで期間を指定できる', async () => {
      const body = await readJson<AttendanceListDto>(
        await api.getList(get('', { employeeId: 'emp-001', query: { from: '2026-10-01', to: '2026-10-31' } })),
      );

      expect(body.from).toBe('2026-10-01');
      expect(body.to).toBe('2026-10-31');
      expect(body.items.map((item) => item.businessDate)).toEqual(['2026-10-31']);
    });

    it('空文字のクエリは省略として扱う', async () => {
      const body = await readJson<AttendanceListDto>(
        await api.getList(get('', { employeeId: 'emp-001', query: { from: '', to: '' } })),
      );

      expect(body.from).toBe('2026-11-01');
      expect(body.to).toBe('2026-11-16');
    });

    it('他の従業員の勤怠は含まない', async () => {
      const body = await readJson<AttendanceListDto>(await api.getList(get('', { employeeId: 'emp-002' })));

      expect(body.items).toEqual([]);
      expect(body.totalWorkMinutes).toBe(0);
    });

    it.each([
      ['日付形式が不正', { from: '2026/11/01' }],
      ['存在しない日付', { to: '2026-02-30' }],
      ['from > to', { from: '2026-11-16', to: '2026-11-01' }],
      ['期間が 93 日を超える', { from: '2026-08-14', to: '2026-11-16' }],
    ])('%s なら 400 VALIDATION_ERROR', async (_label, query) => {
      await expectError(await api.getList(get('', { employeeId: 'emp-001', query })), 400, 'VALIDATION_ERROR');
    });
  });

  // =========================================================
  describe('想定外のエラー', () => {
    const silenceConsoleError = () => vi.spyOn(console, 'error').mockImplementation(() => undefined);

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('ドメイン例外以外のエラーは 500 INTERNAL_ERROR とし、内部のメッセージを漏らさない', async () => {
      silenceConsoleError();
      class BrokenRepository extends InMemoryAttendanceRepository {
        override async findByEmployeeAndPeriod(): Promise<Attendance[]> {
          throw new Error('connection refused: secret-db-host:5432');
        }
      }
      api = createAttendanceHandlers({ attendanceRepository: new BrokenRepository(), clock });

      const body = await expectError(await api.getList(get('', { employeeId: 'emp-001' })), 500, 'INTERNAL_ERROR');

      expect(body.error.message).not.toContain('secret-db-host');
    });

    it('データ破損（INVALID_ATTENDANCE_STATE）も利用者には 500 INTERNAL_ERROR として返す', async () => {
      silenceConsoleError();
      class CorruptedRepository extends InMemoryAttendanceRepository {
        override async findLatestWorkingByEmployee(): Promise<Attendance | null> {
          throw new InvalidAttendanceStateError();
        }
      }
      api = createAttendanceHandlers({ attendanceRepository: new CorruptedRepository(), clock });

      await expectError(await api.clockOut(post('/clock-out', { employeeId: 'emp-001' })), 500, 'INTERNAL_ERROR');
    });
  });
});
