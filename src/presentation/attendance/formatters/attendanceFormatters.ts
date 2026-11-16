import type {
  AttendanceDto,
  AttendanceListDto,
  TodayAttendanceDto,
  TodayAttendanceStatusDto,
} from '../../../application/dto/AttendanceDto';

/**
 * API レスポンス（DTO）→ 画面表示用の整形（requirements.md §4）。
 * 実働・残業などの数値はサーバーが算出した値を表示形式に変換するだけで、再計算はしない。
 */

const EMPTY = '-';
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;
const TIME_ZONE = 'Asia/Tokyo';

const pad2 = (value: number) => String(value).padStart(2, '0');

const jstFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});

const WEEKDAY_INDEX: Readonly<Record<string, number>> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Date を JST の暦・時刻の各要素に分解する */
function toJstParts(date: Date) {
  const parts = Object.fromEntries(jstFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    weekday: WEEKDAYS[WEEKDAY_INDEX[parts.weekday] ?? 0],
  };
}

/** 分 → `H:mm`。null は `-` */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) {
    return EMPTY;
  }
  return `${Math.floor(minutes / 60)}:${pad2(minutes % 60)}`;
}

/** ISO 8601 日時 → JST の `HH:mm`。null・不正な日時は `-` */
export function formatClockTime(isoDateTime: string | null): string {
  if (isoDateTime === null) {
    return EMPTY;
  }
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return EMPTY;
  }
  const { hour, minute } = toJstParts(date);
  return `${hour}:${minute}`;
}

/** `YYYY-MM-DD` → `MM/DD (曜)` */
export function formatBusinessDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${pad2(month)}/${pad2(day)} (${weekday})`;
}

/** 打刻エリアの現在日時（JST）: `YYYY/MM/DD (曜)` と `HH:mm` */
export function formatCurrentDateTime(now: Date): { date: string; time: string } {
  const { year, month, day, hour, minute, weekday } = toJstParts(now);
  return { date: `${year}/${month}/${day} (${weekday})`, time: `${hour}:${minute}` };
}

const STATUS_LABELS: Readonly<Record<TodayAttendanceStatusDto, string>> = {
  NOT_STARTED: '未出勤',
  WORKING: '出勤中',
  FINISHED: '退勤済',
};

export const statusLabelOf = (status: TodayAttendanceStatusDto): string => STATUS_LABELS[status];

// ---------------------------------------------------------------------------
// ViewModel
// ---------------------------------------------------------------------------

export type AttendanceRowViewModel = {
  id: string;
  businessDate: string;
  clockIn: string;
  clockOut: string;
  break: string;
  work: string;
  overtime: string;
  /** 残業が 0 分より大きい（強調表示する） */
  hasOvertime: boolean;
  status: AttendanceDto['status'];
  statusLabel: string;
};

export function toAttendanceRowViewModel(dto: AttendanceDto): AttendanceRowViewModel {
  return {
    id: dto.id,
    businessDate: formatBusinessDate(dto.businessDate),
    clockIn: formatClockTime(dto.clockInAt),
    clockOut: formatClockTime(dto.clockOutAt),
    break: formatMinutes(dto.breakMinutes),
    work: formatMinutes(dto.workMinutes),
    overtime: formatMinutes(dto.overtimeMinutes),
    hasOvertime: dto.overtimeMinutes !== null && dto.overtimeMinutes > 0,
    status: dto.status,
    statusLabel: statusLabelOf(dto.status),
  };
}

export type AttendanceListViewModel = {
  from: string;
  to: string;
  rows: AttendanceRowViewModel[];
  isEmpty: boolean;
  totalWork: string;
  totalOvertime: string;
  hasTotalOvertime: boolean;
};

export function toAttendanceListViewModel(dto: AttendanceListDto): AttendanceListViewModel {
  return {
    from: dto.from,
    to: dto.to,
    rows: dto.items.map(toAttendanceRowViewModel),
    isEmpty: dto.items.length === 0,
    totalWork: formatMinutes(dto.totalWorkMinutes),
    totalOvertime: formatMinutes(dto.totalOvertimeMinutes),
    hasTotalOvertime: dto.totalOvertimeMinutes > 0,
  };
}

export type TodayViewModel = {
  status: TodayAttendanceStatusDto;
  statusLabel: string;
  clockInTime: string | null;
  clockOutTime: string | null;
  /**
   * ボタンの活性制御（requirements.md §4.2）。UX のための補助であり、
   * 二重打刻などの最終判定は常にサーバー側のドメイン層が行う。
   */
  canClockIn: boolean;
  canClockOut: boolean;
};

export function toTodayViewModel(dto: TodayAttendanceDto): TodayViewModel {
  const { attendance } = dto;
  return {
    status: dto.status,
    statusLabel: statusLabelOf(dto.status),
    clockInTime: attendance === null ? null : formatClockTime(attendance.clockInAt),
    clockOutTime: attendance?.clockOutAt ? formatClockTime(attendance.clockOutAt) : null,
    canClockIn: dto.status !== 'WORKING',
    canClockOut: dto.status === 'WORKING',
  };
}
