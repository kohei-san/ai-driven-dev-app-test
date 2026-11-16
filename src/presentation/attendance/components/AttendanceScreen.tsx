'use client';

import { useState } from 'react';
import { useAttendanceScreen } from '../hooks/useAttendanceScreen';
import { AppHeader } from './AppHeader';
import { AttendanceTable } from './AttendanceTable';
import { ClockCard } from './ClockCard';
import { ErrorBanner } from './ErrorBanner';

/** 認証基盤を作り込むまでの仮置き（BR-05）。x-employee-id ヘッダとして送信する */
export const DEFAULT_EMPLOYEE_ID = 'emp-001';

/** 勤怠管理画面（/）。打刻エリア + 勤怠一覧 */
export function AttendanceScreen() {
  const [employeeId, setEmployeeId] = useState(DEFAULT_EMPLOYEE_ID);
  const { state, actions } = useAttendanceScreen(employeeId);

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-100 text-slate-900">
      <AppHeader
        employeeId={employeeId}
        onChangeEmployeeId={(value) => setEmployeeId(value === '' ? DEFAULT_EMPLOYEE_ID : value)}
      />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <ErrorBanner message={state.errorMessage} onDismiss={actions.clearError} />

        <ClockCard
          today={state.today}
          breakMinutesInput={state.breakMinutesInput}
          isSubmitting={state.isSubmitting}
          onChangeBreakMinutes={actions.setBreakMinutesInput}
          onClockIn={() => void actions.clockIn()}
          onClockOut={() => void actions.clockOut()}
        />

        <AttendanceTable
          list={state.list}
          period={state.period}
          isLoading={state.isLoading}
          onChangePeriod={actions.setPeriod}
          onSearch={() => void actions.search()}
        />
      </main>
    </div>
  );
}
