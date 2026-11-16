'use client';

import { useState, type FormEvent } from 'react';

type Props = {
  employeeId: string;
  onChangeEmployeeId: (employeeId: string) => void;
};

/** ヘッダー。従業員 ID（x-employee-id として送信）を切り替えられる（BR-05 の仮置き認証） */
export function AppHeader({ employeeId, onChangeEmployeeId }: Props) {
  const [draft, setDraft] = useState(employeeId);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onChangeEmployeeId(draft.trim());
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <h1 className="text-lg font-bold tracking-tight text-slate-900">勤怠管理</h1>
        <form onSubmit={handleSubmit} className="flex items-center gap-2 text-sm">
          <label htmlFor="employee-id" className="text-slate-600">
            従業員ID
          </label>
          <input
            id="employee-id"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="w-32 rounded-md border border-slate-300 px-2 py-1 font-mono text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            placeholder="emp-001"
          />
          <button
            type="submit"
            disabled={draft.trim() === employeeId}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            切替
          </button>
        </form>
      </div>
    </header>
  );
}
