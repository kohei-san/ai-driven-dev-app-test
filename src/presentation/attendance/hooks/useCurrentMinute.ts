'use client';

import { useSyncExternalStore } from 'react';

const MINUTE_MS = 60_000;

/** 1 秒ごとに確認し、分が変わったときだけ再描画させる */
const subscribe = (onChange: () => void) => {
  const timer = setInterval(onChange, 1_000);
  return () => clearInterval(timer);
};

/** 分単位に切り捨てた現在時刻（ミリ秒）。同じ分の間は同じ値を返す */
const getSnapshot = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;

/** サーバー描画時は時刻を確定させない（ハイドレーションの不一致を避ける） */
const getServerSnapshot = () => null;

/**
 * 表示用の現在時刻（1 分ごとに更新）。打刻時刻はサーバー側で決まるため、表示にのみ使う（P-2）。
 * サーバー描画中は null。
 */
export function useCurrentMinute(): Date | null {
  const epochMs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return epochMs === null ? null : new Date(epochMs);
}
