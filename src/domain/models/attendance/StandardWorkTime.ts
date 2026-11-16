/**
 * 所定労働時間（分）。1 勤怠あたり 8 時間。
 *
 * WorkDuration と OvertimeDuration の双方が参照するため独立したファイルに置き、
 * 両者の循環参照（arch:check の no-circular-dependencies 違反）を避けている。
 */
export const STANDARD_WORK_MINUTES = 480;
