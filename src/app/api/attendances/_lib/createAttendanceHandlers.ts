import { unstable_rethrow } from 'next/navigation';
import type { ClockOutInput } from '../../../../application/dto/AttendanceDto';
import type { IClock } from '../../../../application/ports/IClock';
import { ClockInUseCase } from '../../../../application/usecases/ClockInUseCase';
import { ClockOutUseCase } from '../../../../application/usecases/ClockOutUseCase';
import { GetAttendanceListUseCase } from '../../../../application/usecases/GetAttendanceListUseCase';
import { GetTodayAttendanceUseCase } from '../../../../application/usecases/GetTodayAttendanceUseCase';
import { DomainError, ValidationError } from '../../../../domain/errors';
import type { IAttendanceRepository } from '../../../../domain/repositories/IAttendanceRepository';
import { AttendanceDuplicationChecker } from '../../../../domain/services/AttendanceDuplicationChecker';

/** BR-05（仮置き）: ヘッダがない・空のときにログイン済みとみなす従業員 */
export const DEFAULT_EMPLOYEE_ID = 'emp-001';
const EMPLOYEE_ID_HEADER = 'x-employee-id';

export type AttendanceHandlerDeps = {
  readonly attendanceRepository: IAttendanceRepository;
  readonly clock: IClock;
};

type Handler = (request: Request) => Promise<Response>;

export type AttendanceHandlers = {
  /** POST /api/attendances/clock-in */
  readonly clockIn: Handler;
  /** POST /api/attendances/clock-out */
  readonly clockOut: Handler;
  /** GET /api/attendances/today */
  readonly getToday: Handler;
  /** GET /api/attendances */
  readonly getList: Handler;
};

// ---------------------------------------------------------------------------
// エラー → HTTP レスポンス
// ---------------------------------------------------------------------------

/** ドメイン例外のコード → HTTP ステータス。ここにないコードは 500 として扱う */
const STATUS_BY_ERROR_CODE: Readonly<Record<string, number>> = {
  VALIDATION_ERROR: 400,
  INVALID_BREAK_DURATION: 400,
  ALREADY_CLOCKED_IN: 409,
  NOT_CLOCKED_IN: 409,
  ATTENDANCE_ALREADY_FINISHED: 409,
  INVALID_CLOCK_OUT_TIME: 422,
};

const errorResponse = (status: number, code: string, message: string): Response =>
  Response.json({ error: { code, message } }, { status });

function toErrorResponse(error: unknown): Response {
  if (error instanceof DomainError) {
    const status = STATUS_BY_ERROR_CODE[error.code];
    if (status !== undefined) {
      return errorResponse(status, error.code, error.message);
    }
  }
  // 想定外のエラー・データ破損（INVALID_ATTENDANCE_STATE など）は内部情報を返さず、ログにだけ残す
  console.error('[api/attendances] unexpected error', error);
  return errorResponse(500, 'INTERNAL_ERROR', 'サーバー内部でエラーが発生しました');
}

/** 例外をすべてエラーレスポンスに変換する */
const withErrorHandling =
  (handler: Handler): Handler =>
  async (request) => {
    try {
      return await handler(request);
    } catch (error) {
      // Next.js の制御用例外（プリレンダリング中断など）は握りつぶさず Next.js に委ねる
      unstable_rethrow(error);
      return toErrorResponse(error);
    }
  };

// ---------------------------------------------------------------------------
// リクエストの解釈（HTTP の関心事のみ。業務的な検証はユースケース / ドメインが行う）
// ---------------------------------------------------------------------------

/** BR-05: ヘッダがない・空白のみなら既定の従業員。形式の検証は EmployeeId が行う */
function resolveEmployeeId(request: Request): string {
  const header = request.headers.get(EMPLOYEE_ID_HEADER);
  return header === null || header.trim() === '' ? DEFAULT_EMPLOYEE_ID : header;
}

/** クエリパラメータ。空文字は省略として扱う */
function readQuery(request: Request, name: string): string | undefined {
  const value = new URL(request.url).searchParams.get(name);
  return value === null || value === '' ? undefined : value;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** 退勤のボディ `{ breakMinutes?: number }`。ボディなしは `{}` とみなす */
async function readClockOutBody(request: Request): Promise<Pick<ClockOutInput, 'breakMinutes'>> {
  const text = await request.text();
  if (text.trim() === '') {
    return {};
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ValidationError('リクエストボディが JSON として解釈できません');
  }
  if (!isPlainObject(body)) {
    throw new ValidationError('リクエストボディは JSON オブジェクトで指定してください');
  }

  const { breakMinutes } = body;
  if (breakMinutes === undefined) {
    return {};
  }
  if (typeof breakMinutes !== 'number') {
    throw new ValidationError('breakMinutes は数値（分）で指定してください');
  }
  // 整数・0 以上かどうかは BreakDuration が検証する（INVALID_BREAK_DURATION）
  return { breakMinutes };
}

// ---------------------------------------------------------------------------
// ハンドラの組み立て
// ---------------------------------------------------------------------------

/**
 * 勤怠 API のハンドラを依存（リポジトリ・時計）から組み立てる。
 * route.ts は HTTP メソッド名しか export できないため、テスト可能な本体をここに置き、
 * route.ts は本番用の依存で組み立てたハンドラを export するだけにする。
 */
export function createAttendanceHandlers({ attendanceRepository, clock }: AttendanceHandlerDeps): AttendanceHandlers {
  const clockInUseCase = new ClockInUseCase({
    attendanceRepository,
    duplicationChecker: new AttendanceDuplicationChecker(attendanceRepository),
    clock,
  });
  const clockOutUseCase = new ClockOutUseCase({ attendanceRepository, clock });
  const getTodayUseCase = new GetTodayAttendanceUseCase({ attendanceRepository, clock });
  const getListUseCase = new GetAttendanceListUseCase({ attendanceRepository, clock });

  return {
    // ボディは受け付けない（打刻時刻はサーバーの現在時刻: P-2）
    clockIn: withErrorHandling(async (request) => {
      const dto = await clockInUseCase.execute({ employeeId: resolveEmployeeId(request) });
      return Response.json(dto, { status: 201 });
    }),

    clockOut: withErrorHandling(async (request) => {
      const employeeId = resolveEmployeeId(request);
      const body = await readClockOutBody(request);
      return Response.json(await clockOutUseCase.execute({ employeeId, ...body }));
    }),

    getToday: withErrorHandling(async (request) =>
      Response.json(await getTodayUseCase.execute({ employeeId: resolveEmployeeId(request) })),
    ),

    getList: withErrorHandling(async (request) =>
      Response.json(
        await getListUseCase.execute({
          employeeId: resolveEmployeeId(request),
          from: readQuery(request, 'from'),
          to: readQuery(request, 'to'),
        }),
      ),
    ),
  };
}
