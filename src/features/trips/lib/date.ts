import { format, parse } from 'date-fns';

const DATE_ONLY_FORMAT = 'yyyy-MM-dd';

/** Serializes a `Date` to the `yyyy-MM-dd` string Convex stores for trip dates. */
export function toDateOnlyString(date: Date) {
  return format(date, DATE_ONLY_FORMAT);
}

/** Parses a stored `yyyy-MM-dd` string back to a local `Date` for form defaults. */
export function fromDateOnlyString(value: string) {
  return parse(value, DATE_ONLY_FORMAT, new Date());
}

export function todayDateOnlyString() {
  return toDateOnlyString(new Date());
}
