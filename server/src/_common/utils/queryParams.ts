import { ParsedQs } from 'qs';

/**
 * Safely converts query parameter to string
 */
export function asString(value: string | ParsedQs | (string | ParsedQs)[] | undefined, defaultValue: string = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  return defaultValue;
}

/**
 * Safely converts query parameter to number
 */
export function asNumber(value: string | ParsedQs | (string | ParsedQs)[] | undefined, defaultValue: number = 0): number {
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }
  return defaultValue;
}