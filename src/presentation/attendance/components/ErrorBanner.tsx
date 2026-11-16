type Props = {
  message: string | null;
  onDismiss: () => void;
};

/** API のエラーメッセージ（error.message）を表示する通知バナー */
export function ErrorBanner({ message, onDismiss }: Props) {
  if (message === null) {
    return null;
  }
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span aria-hidden className="mt-0.5 font-bold">
        ⚠
      </span>
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="エラーを閉じる"
        className="rounded px-1 text-red-600 hover:bg-red-100 hover:text-red-800"
      >
        ✕
      </button>
    </div>
  );
}
