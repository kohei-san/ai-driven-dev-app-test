import { describe, expect, it } from 'vitest';
import { GET as getList } from './route';
import { POST as clockIn } from './clock-in/route';
import { POST as clockOut } from './clock-out/route';
import { GET as getToday } from './today/route';

/**
 * route.ts の配線テスト。
 * route.ts は HTTP メソッド名しか export できないため、振る舞いの詳細は
 * _lib/createAttendanceHandlers.test.ts で検証し、ここでは「各ルートが本番用の依存
 * （InMemoryAttendanceRepository + SystemClock）で正しく組み立てられ、状態を共有していること」だけを確認する。
 */
describe('勤怠 API の route.ts', () => {
  // 本番用のシングルトンを使うため、他のテストと衝突しない従業員IDを使う
  const employeeId = `route-test-${Date.now()}`;
  const url = (path: string) => `http://localhost/api/attendances${path}`;
  const headers = { 'x-employee-id': employeeId };

  it('各ルートが HTTP メソッドに対応する handler を export している', () => {
    expect(typeof clockIn).toBe('function');
    expect(typeof clockOut).toBe('function');
    expect(typeof getToday).toBe('function');
    expect(typeof getList).toBe('function');
  });

  it('出勤 → 当日状況 → 一覧 が同じリポジトリを共有している', async () => {
    const clockInResponse = await clockIn(new Request(url('/clock-in'), { method: 'POST', headers }));
    expect(clockInResponse.status).toBe(201);

    const todayResponse = await getToday(new Request(url('/today'), { headers }));
    expect(todayResponse.status).toBe(200);
    expect(((await todayResponse.json()) as { status: string }).status).toBe('WORKING');

    const listResponse = await getList(new Request(url(''), { headers }));
    expect(listResponse.status).toBe(200);
    expect(((await listResponse.json()) as { items: unknown[] }).items).toHaveLength(1);
  });

  it('clock-out ルートも同じリポジトリを参照する（未出勤の従業員は 409）', async () => {
    const response = await clockOut(
      new Request(url('/clock-out'), { method: 'POST', headers: { 'x-employee-id': `${employeeId}-other` } }),
    );
    expect(response.status).toBe(409);
  });
});
