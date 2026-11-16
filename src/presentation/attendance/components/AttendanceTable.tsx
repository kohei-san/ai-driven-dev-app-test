import type { FormEvent } from 'react';
import type { AttendanceListDto } from '../../../application/dto/AttendanceDto';
import { toAttendanceListViewModel } from '../formatters/attendanceFormatters';
import type { PeriodInput } from '../state/attendanceScreenStore';
import { StatusBadge } from './StatusBadge';

type Props = {
  list: AttendanceListDto | null;
  period: PeriodInput;
  isLoading: boolean;
  onChangePeriod: (period: Partial<PeriodInput>) => void;
  onSearch: () => void;
};

const dateInputClass =
  'rounded-md border border-slate-300 px-2 py-1 font-mono text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200';
const th = 'px-3 py-2 font-medium';
const num = 'px-3 py-2 text-right font-mono tabular-nums';

/** 勤怠履歴一覧テーブル（requirements.md §4.3） */
export function AttendanceTable({ list, period, isLoading, onChangePeriod, onSearch }: Props) {
  const vm = list === null ? null : toAttendanceListViewModel(list);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch();
  };

  return (
    <section aria-labelledby="attendance-list-title" className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <h2 id="attendance-list-title" className="text-sm font-semibold text-slate-500">
          勤怠一覧
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="period-from" className="text-slate-600">
            期間
          </label>
          <input
            id="period-from"
            type="date"
            value={period.from}
            onChange={(event) => onChangePeriod({ from: event.target.value })}
            className={dateInputClass}
          />
          <span className="text-slate-500">〜</span>
          <input
            id="period-to"
            type="date"
            aria-label="期間（終了日）"
            value={period.to}
            onChange={(event) => onChangePeriod({ to: event.target.value })}
            className={dateInputClass}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-md bg-slate-800 px-4 py-1.5 font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            表示
          </button>
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th scope="col" className={th}>営業日</th>
              <th scope="col" className={`${th} text-right`}>出勤</th>
              <th scope="col" className={`${th} text-right`}>退勤</th>
              <th scope="col" className={`${th} text-right`}>休憩</th>
              <th scope="col" className={`${th} text-right`}>実働</th>
              <th scope="col" className={`${th} text-right`}>残業</th>
              <th scope="col" className={`${th} text-center`}>状態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-900">
            {vm === null ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                  読み込み中…
                </td>
              </tr>
            ) : vm.isEmpty ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                  この期間の勤怠記録はありません
                </td>
              </tr>
            ) : (
              vm.rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono tabular-nums">{row.businessDate}</td>
                  <td className={num}>{row.clockIn}</td>
                  <td className={num}>{row.clockOut}</td>
                  <td className={num}>{row.break}</td>
                  <td className={num}>{row.work}</td>
                  <td className={`${num} ${row.hasOvertime ? 'font-semibold text-orange-600' : ''}`}>{row.overtime}</td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={row.status} size="sm" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {vm !== null && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-900">
              <tr>
                <th scope="row" colSpan={4} className="px-3 py-2 text-left">
                  合計 <span className="font-normal text-slate-500">（退勤済のみ）</span>
                </th>
                <td className={num}>{vm.totalWork}</td>
                <td className={`${num} ${vm.hasTotalOvertime ? 'text-orange-600' : ''}`}>{vm.totalOvertime}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}
