'use client';

import type { TodayAttendanceDto } from '../../../application/dto/AttendanceDto';
import { formatCurrentDateTime, toTodayViewModel } from '../formatters/attendanceFormatters';
import { useCurrentMinute } from '../hooks/useCurrentMinute';
import { StatusBadge } from './StatusBadge';

type Props = {
  today: TodayAttendanceDto | null;
  breakMinutesInput: string;
  isSubmitting: boolean;
  onChangeBreakMinutes: (value: string) => void;
  onClockIn: () => void;
  onClockOut: () => void;
};

/** 本日の打刻操作カード（requirements.md §4.2） */
export function ClockCard({ today, breakMinutesInput, isSubmitting, onChangeBreakMinutes, onClockIn, onClockOut }: Props) {
  const now = useCurrentMinute();
  const current = now === null ? null : formatCurrentDateTime(now);
  const vm = today === null ? null : toTodayViewModel(today);

  // 活性制御は UX の補助。最終判定はサーバー側のドメイン層で行われる
  const canClockIn = vm !== null && vm.canClockIn && !isSubmitting;
  const canClockOut = vm !== null && vm.canClockOut && !isSubmitting;

  return (
    <section aria-labelledby="clock-card-title" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 id="clock-card-title" className="text-sm font-semibold text-slate-500">
        本日の打刻
      </h2>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm text-slate-500" suppressHydrationWarning>
            {current?.date ?? ' '}
          </p>
          <p className="font-mono text-4xl font-semibold tabular-nums tracking-tight text-slate-900">
            {current?.time ?? '--:--'}
          </p>
        </div>

        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div className="flex items-center gap-2">
            <dt className="text-slate-500">ステータス</dt>
            <dd>{vm === null ? <span className="text-slate-400">読み込み中…</span> : <StatusBadge status={vm.status} />}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-slate-500">出勤</dt>
            <dd className="font-mono tabular-nums text-slate-900">{vm?.clockInTime ?? '--:--'}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-slate-500">退勤</dt>
            <dd className="font-mono tabular-nums text-slate-900">{vm?.clockOutTime ?? '--:--'}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
        <button
          type="button"
          onClick={onClockIn}
          disabled={!canClockIn}
          className="min-w-32 rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          出勤
        </button>

        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="break-minutes" className="text-slate-600">
            休憩
          </label>
          <input
            id="break-minutes"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={breakMinutesInput}
            onChange={(event) => onChangeBreakMinutes(event.target.value)}
            disabled={!canClockOut}
            className="w-20 rounded-md border border-slate-300 px-2 py-2 text-right font-mono tabular-nums text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          />
          <span className="text-slate-600">分</span>
        </div>

        <button
          type="button"
          onClick={onClockOut}
          disabled={!canClockOut}
          className="min-w-32 rounded-lg bg-orange-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          退勤
        </button>

        {isSubmitting && <span className="text-sm text-slate-500">送信中…</span>}
      </div>
    </section>
  );
}
