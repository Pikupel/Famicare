import { getCalendarOffset, MONTHS, WEEKDAYS } from '../src/utils/calendar';

describe('calendar helpers', () => {
  test('uses Monday as the first day and keeps Turkish labels complete', () => {
    expect(getCalendarOffset(2026, 5)).toBe(0); // 1 June 2026 is Monday
    expect(getCalendarOffset(2026, 7)).toBe(5); // 1 August 2026 is Saturday
    expect(MONTHS).toHaveLength(12);
    expect(WEEKDAYS).toEqual(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);
  });
});
