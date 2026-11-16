import type { IAttendanceRepository } from '../../../../domain/repositories/IAttendanceRepository';
import { SystemClock } from '../../../../infrastructure/clock/SystemClock';
import { InMemoryAttendanceRepository } from '../../../../infrastructure/repositories/InMemoryAttendanceRepository';
import { createAttendanceHandlers } from './createAttendanceHandlers';

/**
 * 勤怠 API の DI コンテナ（コンポジションルート）。
 * 具体クラス（infrastructure）を知ってよいのはこのファイルだけにする。
 *
 * InMemoryAttendanceRepository を globalThis に保持する理由:
 * - 開発サーバーでは route.ts ごとに別のモジュールとしてバンドルされることがあり、
 *   モジュールスコープの変数だと出勤（clock-in）と一覧（GET）で別々のストアになり得る
 * - HMR でモジュールが再評価されてもデータが消えないようにする
 * DB 実装（PrismaAttendanceRepository など）に差し替える際は、ここを書き換えるだけでよい。
 */
const globalStore = globalThis as typeof globalThis & {
  __attendanceRepository?: IAttendanceRepository;
};

globalStore.__attendanceRepository ??= new InMemoryAttendanceRepository();

export const attendanceHandlers = createAttendanceHandlers({
  attendanceRepository: globalStore.__attendanceRepository,
  clock: new SystemClock(),
});
