const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 0) return "방금 전";
  if (diffSec < MINUTE) return "방금 전";
  if (diffSec < HOUR) {
    const mins = Math.floor(diffSec / MINUTE);
    return `${mins}분 전`;
  }
  if (diffSec < DAY) {
    const hours = Math.floor(diffSec / HOUR);
    return `${hours}시간 전`;
  }
  if (diffSec < 2 * DAY) return "어제";
  if (diffSec < WEEK) {
    const days = Math.floor(diffSec / DAY);
    return `${days}일 전`;
  }
  if (diffSec < MONTH) {
    const weeks = Math.floor(diffSec / WEEK);
    return `${weeks}주 전`;
  }
  if (diffSec < YEAR) {
    const months = Math.floor(diffSec / MONTH);
    return `${months}개월 전`;
  }
  const years = Math.floor(diffSec / YEAR);
  return `${years}년 전`;
}
