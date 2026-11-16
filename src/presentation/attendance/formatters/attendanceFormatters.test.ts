import { describe, expect, it } from 'vitest';
import {
  attendanceListDto,
  finishedAttendanceDto,
  todayDto,
  workingAttendanceDto,
} from '../../../test-utils/attendanceDtoFixtures';
import {
  formatBusinessDate,
  formatClockTime,
  formatCurrentDateTime,
  formatMinutes,
  toAttendanceListViewModel,
  toAttendanceRowViewModel,
  toTodayViewModel,
} from './attendanceFormatters';

/**
 * API レスポンス（DTO）→ 画面表示用の整形（requirements.md §4）。
 * 実働・残業などの数値はサーバーが算出した値をそのまま表示形式に変換するだけで、再計算はしない。
 */

describe('formatMinutes（H:mm 表示）', () => {
  it.each([
    [480, '8:00'],
    [630, '10:30'],
    [150, '2:30'],
    [485, '8:05'],
    [5, '0:05'],
    [0, '0:00'],
    [1, '0:01'],
  ])('%i 分 → %s', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });

  it('null は "-" を表示する', () => {
    expect(formatMinutes(null)).toBe('-');
  });
});

describe('formatClockTime（HH:mm 表示）', () => {
  it('JST オフセット付き ISO 8601 から時刻を取り出す', () => {
    expect(formatClockTime('2026-11-16T09:02:00+09:00')).toBe('09:02');
    expect(formatClockTime('2026-11-14T20:30:59+09:00')).toBe('20:30');
  });

  it('JST 以外のオフセットでも JST の時刻で表示する（P-1）', () => {
    expect(formatClockTime('2026-11-16T00:02:00Z')).toBe('09:02');
    expect(formatClockTime('2026-11-15T15:00:00Z')).toBe('00:00');
  });

  it('null は "-" を表示する', () => {
    expect(formatClockTime(null)).toBe('-');
  });
});

describe('formatBusinessDate（MM/DD (曜) 表示）', () => {
  it.each([
    ['2026-11-16', '11/16 (月)'],
    ['2026-11-13', '11/13 (金)'],
    ['2026-11-15', '11/15 (日)'],
    ['2026-01-03', '01/03 (土)'],
  ])('%s → %s', (date, expected) => {
    expect(formatBusinessDate(date)).toBe(expected);
  });
});

describe('formatCurrentDateTime（打刻エリアの現在日時）', () => {
  it('JST の日付（YYYY/MM/DD (曜)）と時刻（HH:mm）に整形する', () => {
    expect(formatCurrentDateTime(new Date('2026-11-16T05:32:45Z'))).toEqual({
      date: '2026/11/16 (月)',
      time: '14:32',
    });
  });

  it('UTC では前日でも JST の日付で表示する', () => {
    expect(formatCurrentDateTime(new Date('2026-11-15T15:00:00Z'))).toEqual({
      date: '2026/11/16 (月)',
      time: '00:00',
    });
  });
});

describe('toAttendanceRowViewModel（勤怠一覧の 1 行）', () => {
  it('退勤済の勤怠を表示形式に変換する', () => {
    const row = toAttendanceRowViewModel(finishedAttendanceDto());

    expect(row).toEqual({
      id: 'att-finished',
      businessDate: '11/13 (金)',
      clockIn: '09:00',
      clockOut: '20:30',
      break: '1:00',
      work: '10:30',
      overtime: '2:30',
      hasOvertime: true,
      statusLabel: '退勤済',
    });
  });

  it('出勤中の勤怠は退勤・休憩・実働・残業を "-" で表示する', () => {
    const row = toAttendanceRowViewModel(workingAttendanceDto());

    expect(row).toEqual({
      id: 'att-working',
      businessDate: '11/16 (月)',
      clockIn: '09:02',
      clockOut: '-',
      break: '-',
      work: '-',
      overtime: '-',
      hasOvertime: false,
      statusLabel: '出勤中',
    });
  });

  it('残業が 0 分のときは強調しない', () => {
    const row = toAttendanceRowViewModel(finishedAttendanceDto({ workMinutes: 480, overtimeMinutes: 0 }));

    expect(row.overtime).toBe('0:00');
    expect(row.hasOvertime).toBe(false);
  });

  it('日付をまたいだ勤務でも営業日は DTO の businessDate を表示する（P-4）', () => {
    const row = toAttendanceRowViewModel(
      finishedAttendanceDto({
        businessDate: '2026-11-15',
        clockInAt: '2026-11-15T22:00:00+09:00',
        clockOutAt: '2026-11-16T06:00:00+09:00',
      }),
    );

    expect(row.businessDate).toBe('11/15 (日)');
    expect(row.clockIn).toBe('22:00');
    expect(row.clockOut).toBe('06:00');
  });
});

describe('toAttendanceListViewModel（勤怠一覧テーブル）', () => {
  it('行の並びは API の返却順（営業日の降順）をそのまま保つ', () => {
    const vm = toAttendanceListViewModel(
      attendanceListDto({
        items: [
          workingAttendanceDto({ id: 'a3', businessDate: '2026-11-16' }),
          finishedAttendanceDto({ id: 'a2', businessDate: '2026-11-14' }),
          finishedAttendanceDto({ id: 'a1', businessDate: '2026-11-13' }),
        ],
      }),
    );

    expect(vm.rows.map((row) => row.id)).toEqual(['a3', 'a2', 'a1']);
  });

  it('合計行は API が集計した実働・残業の合計を表示する（UI で再計算しない）', () => {
    const vm = toAttendanceListViewModel(
      attendanceListDto({
        items: [finishedAttendanceDto({ workMinutes: 480, overtimeMinutes: 0 })],
        // items と食い違っていても API の合計値を正とする
        totalWorkMinutes: 1115,
        totalOvertimeMinutes: 155,
      }),
    );

    expect(vm.totalWork).toBe('18:35');
    expect(vm.totalOvertime).toBe('2:35');
    expect(vm.hasTotalOvertime).toBe(true);
  });

  it('期間（from / to）を保持する', () => {
    const vm = toAttendanceListViewModel(attendanceListDto({ from: '2026-11-01', to: '2026-11-16' }));

    expect(vm.from).toBe('2026-11-01');
    expect(vm.to).toBe('2026-11-16');
  });

  it('レコードがないときは空の行と 0:00 の合計を返す', () => {
    const vm = toAttendanceListViewModel(attendanceListDto());

    expect(vm.rows).toEqual([]);
    expect(vm.isEmpty).toBe(true);
    expect(vm.totalWork).toBe('0:00');
    expect(vm.totalOvertime).toBe('0:00');
    expect(vm.hasTotalOvertime).toBe(false);
  });
});

describe('toTodayViewModel（打刻エリア）', () => {
  it('未出勤: 出勤ボタンのみ有効', () => {
    const vm = toTodayViewModel(todayDto({ status: 'NOT_STARTED', attendance: null }));

    expect(vm).toEqual({
      status: 'NOT_STARTED',
      statusLabel: '未出勤',
      clockInTime: null,
      clockOutTime: null,
      canClockIn: true,
      canClockOut: false,
    });
  });

  it('出勤中: 出勤時刻を表示し、退勤ボタン（と休憩入力）のみ有効', () => {
    const vm = toTodayViewModel(todayDto({ status: 'WORKING', attendance: workingAttendanceDto() }));

    expect(vm).toEqual({
      status: 'WORKING',
      statusLabel: '出勤中',
      clockInTime: '09:02',
      clockOutTime: null,
      canClockIn: false,
      canClockOut: true,
    });
  });

  it('退勤済: 出勤・退勤時刻を表示し、出勤ボタンのみ有効（同日 2 件目の出勤ができる: AC-02-3）', () => {
    const vm = toTodayViewModel(
      todayDto({
        status: 'FINISHED',
        attendance: finishedAttendanceDto({
          businessDate: '2026-11-16',
          clockInAt: '2026-11-16T09:00:00+09:00',
          clockOutAt: '2026-11-16T12:00:00+09:00',
        }),
      }),
    );

    expect(vm).toEqual({
      status: 'FINISHED',
      statusLabel: '退勤済',
      clockInTime: '09:00',
      clockOutTime: '12:00',
      canClockIn: true,
      canClockOut: false,
    });
  });

  it('日付またぎで前日から出勤中の勤怠も「出勤中」として退勤できる（F-03）', () => {
    const vm = toTodayViewModel(
      todayDto({
        businessDate: '2026-11-16',
        status: 'WORKING',
        attendance: workingAttendanceDto({ businessDate: '2026-11-15', clockInAt: '2026-11-15T22:00:00+09:00' }),
      }),
    );

    expect(vm.statusLabel).toBe('出勤中');
    expect(vm.clockInTime).toBe('22:00');
    expect(vm.canClockOut).toBe(true);
  });
});
