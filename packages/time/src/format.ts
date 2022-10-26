//  Formats the time since the startMs to a string in seconds as a string with 3 decimal places.
//  For example, 0.000s, 0.001s, 0.123s, 1.000s, 1.123s, 123.456s
export function formatElapsed(startMs: number): string {
  const elapsedSeconds = ((+new Date() - startMs) / 1000).toFixed(3)
  return elapsedSeconds + 's'
}
