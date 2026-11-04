import { config } from '../config.js';

function partsInTz(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return parts;
}

export function todayInTz(date = new Date(), timeZone = config.restaurantTz) {
  const parts = partsInTz(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function timeInTz(date = new Date(), timeZone = config.restaurantTz) {
  const parts = partsInTz(date, timeZone);
  return `${parts.hour}:${parts.minute}`;
}

export function timezoneLabel(timeZone = config.restaurantTz) {
  return timeZone;
}

export function dateTimeInTz(date, timeZone = config.restaurantTz) {
  return `${todayInTz(date, timeZone)} ${timeInTz(date, timeZone)}`;
}
