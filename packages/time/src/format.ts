//  Formats the time since the startMs to a string in seconds as a string with 3 decimal places.
//  For example, 0.000s, 0.001s, 0.123s, 1.000s, 1.123s, 123.456s
export function formatElapsed(startMs: number): string {
  const elapsedSeconds = ((+new Date() - startMs) / 1000).toFixed(3)
  return elapsedSeconds + 's'
}

/**
 * TODO Consider other options
 * - use String.padStart
 * - consider use in chapters.yml
 * - constant width seconds and minutes (if no leading 0)
 * - consider using ':' as separator
 * - we don't want days, max unit is hours, even above 24h
 * - fractional seconds?
 */
export function durationToHMS(seconds: number): string {
  // assume seconds is an integer > 0
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) {
    return `${h}h${m}m${s}s`
  }
  if (m > 0) {
    return `${m}m${s}s`
  }
  return `${s}s`
}
