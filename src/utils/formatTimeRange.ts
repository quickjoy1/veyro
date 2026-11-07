import { to12Hour } from '@/utils/timeUtils';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const formatRecurrence = (weekdays: number[]): string => {
  if (weekdays.length === 7) return 'Every day';
  if (weekdays.length === 1) return `Every ${WEEKDAY_NAMES[weekdays[0] ?? 0]}`;
  return `Every ${weekdays.map((d) => WEEKDAY_NAMES[d]).join(', ')}`;
};

/** "8-9 AM" instead of "08:00 AM - 09:00 AM" (same style as the task card). Inputs are HH:MM in local time. */
export const formatTimeRange = (start: string | null | undefined, end: string | null | undefined): string => {
  if (!start) return '';
  const s = to12Hour(start);
  if (!end) return s;
  const e = to12Hour(end);
  const [sHM = '', sPeriod = ''] = s.split(' ');
  const [eHM = '', ePeriod = ''] = e.split(' ');
  const trim = (hm: string) => (hm.endsWith(':00') ? hm.slice(0, -3) : hm);
  if (sPeriod === ePeriod) return `${trim(sHM)}\u2013${trim(eHM)} ${sPeriod}`;
  return `${trim(sHM)} ${sPeriod} \u2013 ${trim(eHM)} ${ePeriod}`;
};
