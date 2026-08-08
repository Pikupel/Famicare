export const DEFAULT_TIMEZONE = 'Europe/Istanbul';

export function getUserTimezone(user) {
  return user?.timezone || DEFAULT_TIMEZONE;
}

export function localDate(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function localDateTimeParts(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

export function dateDaysAgo(days, timezone = DEFAULT_TIMEZONE) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return localDate(date, timezone);
}

export function isMedicationActiveOn(medication, dateKey) {
  if (medication.isActive === false) return false;
  if (!medication.endDate) return true;
  const normalizedEnd = /^\d{2}\.\d{2}\.\d{4}$/.test(medication.endDate)
    ? medication.endDate.split('.').reverse().join('-')
    : medication.endDate;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedEnd) && normalizedEnd >= dateKey;
}
