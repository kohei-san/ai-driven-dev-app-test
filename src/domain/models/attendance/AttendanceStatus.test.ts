import { describe, expect, it } from 'vitest';
import { AttendanceStatus } from './AttendanceStatus';

describe('AttendanceStatus（勤怠ステータス）', () => {
  it('出勤中は "WORKING"', () => {
    expect(AttendanceStatus.WORKING).toBe('WORKING');
  });

  it('退勤済は "FINISHED"', () => {
    expect(AttendanceStatus.FINISHED).toBe('FINISHED');
  });

  it('定義されるステータスは WORKING と FINISHED の 2 つのみ（未出勤はレコードなしで表す）', () => {
    expect(Object.values(AttendanceStatus).sort()).toEqual(['FINISHED', 'WORKING']);
  });
});
