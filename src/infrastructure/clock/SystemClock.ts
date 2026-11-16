import type { IClock } from '../../application/ports/IClock';

/** 本番用の時計。OS のシステム時刻を返す */
export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}
