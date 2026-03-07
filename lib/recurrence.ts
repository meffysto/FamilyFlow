/**
 * recurrence.ts — Calculate next occurrence for recurring tasks
 * Handles: every day, every week, every month, every 2 weeks, etc.
 */

import { addDays, addWeeks, addMonths, format, parse, isValid } from 'date-fns';

/**
 * Calculate the next due date for a recurring task.
 * @param currentDate - Current due date in YYYY-MM-DD
 * @param recurrence - Recurrence string like "every day", "every week", "every month"
 * @returns Next due date in YYYY-MM-DD format
 */
export function nextOccurrence(currentDate: string, recurrence: string): string {
  const base = parse(currentDate, 'yyyy-MM-dd', new Date());
  if (!isValid(base)) return currentDate;

  const lower = recurrence.toLowerCase().trim();

  // Parse "every N unit" pattern
  const match = lower.match(/^every\s+(?:(\d+)\s+)?(day|week|month)s?$/);
  if (!match) return currentDate;

  const count = match[1] ? parseInt(match[1], 10) : 1;
  const unit = match[2];

  let next: Date;
  switch (unit) {
    case 'day':
      next = addDays(base, count);
      break;
    case 'week':
      next = addWeeks(base, count);
      break;
    case 'month':
      next = addMonths(base, count);
      break;
    default:
      return currentDate;
  }

  // If next date is still in the past, advance to today + interval
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (next < today) {
    switch (unit) {
      case 'day':
        next = addDays(next, count);
        break;
      case 'week':
        next = addWeeks(next, count);
        break;
      case 'month':
        next = addMonths(next, count);
        break;
    }
  }

  return format(next, 'yyyy-MM-dd');
}
