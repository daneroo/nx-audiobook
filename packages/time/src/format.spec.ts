import { describe, expect, test, it } from 'vitest'
import { formatElapsed, durationToHMS } from './format'

describe('formatElapsed', () => {
  it('should format a zero duration', () => {
    // this might be brittle as formatElapsed references the current time (+new Date())
    const startMs = +new Date()
    // expect(formatElapsed(startMs)).toEqual('0.000s')
    expect(formatElapsed(startMs)).toMatch(/^0\.00\ds$/)
  })
})

describe('durationToHMS', () => {
  it('should format 0s', () => {
    expect(durationToHMS(0)).toEqual('0s')
  })
  test.each([
    [0, '0s'],
    [1, '1s'],
    [59, '59s'],
    [75, '1m15s'],
    [3666, '1h1m6s'],
    [86401, '24h0m1s'],
  ])('%# durationToHMS %p: %p', (seconds, expected) => {
    expect(durationToHMS(seconds)).toBe(expected)
  })
})
