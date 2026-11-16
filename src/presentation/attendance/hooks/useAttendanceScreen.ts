'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createAttendanceApiClient } from '../api/AttendanceApiClient';
import { createAttendanceScreenStore, type AttendanceScreenState, type AttendanceScreenStore } from '../state/attendanceScreenStore';

export type UseAttendanceScreenResult = {
  readonly state: AttendanceScreenState;
  readonly actions: Omit<AttendanceScreenStore, 'getState' | 'subscribe'>;
};

/**
 * 勤怠画面のストアを従業員ごとに生成し、React から購読する薄いラッパー。
 * 状態遷移のロジックはすべて attendanceScreenStore にあり、ここでは配線だけを行う。
 */
export function useAttendanceScreen(employeeId: string): UseAttendanceScreenResult {
  const store = useMemo(
    () => createAttendanceScreenStore({ api: createAttendanceApiClient({ employeeId }) }),
    [employeeId],
  );

  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);

  useEffect(() => {
    void store.load();
  }, [store]);

  return { state, actions: store };
}
