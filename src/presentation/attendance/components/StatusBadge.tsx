import type { TodayAttendanceStatusDto } from '../../../application/dto/AttendanceDto';
import { statusLabelOf } from '../formatters/attendanceFormatters';

const STYLES: Readonly<Record<TodayAttendanceStatusDto, string>> = {
  NOT_STARTED: 'bg-slate-100 text-slate-700 ring-slate-300',
  WORKING: 'bg-emerald-50 text-emerald-700 ring-emerald-300',
  FINISHED: 'bg-sky-50 text-sky-700 ring-sky-300',
};

export function StatusBadge({ status, size = 'md' }: { status: TodayAttendanceStatusDto; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${sizeClass} ${STYLES[status]}`}>
      {status === 'WORKING' && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      {statusLabelOf(status)}
    </span>
  );
}
