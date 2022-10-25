import { describe, expect, test, it, vi } from 'vitest'
import chalk from 'chalk'
import { checkMark, show } from './show'
import type { Validation } from './types'

describe('checkMark - no color', () => {
  test.each([
    [true, '✔'],
    [false, '✕'],
  ])('%# checkMark %p: %p', (bool, expected) => {
    const withColor = false
    expect(checkMark(bool, withColor)).toBe(expected)
  })
})

describe('checkMark - with color', () => {
  const restoreChalkLevel = chalk.level
  chalk.level = 1
  test.each([
    [true, [27, 91, 51, 50, 109, 226, 156, 148, 27, 91, 51, 57, 109]],
    [false, [27, 91, 51, 49, 109, 226, 156, 149, 27, 91, 51, 57, 109]],
  ])('%# checkMark %p: %p', (bool, expected) => {
    // skip this test if chalk has disabled color
    if (chalk.level > 0) {
      const withColor = true
      const checkMarkWithColor: string = checkMark(bool, withColor)
      const asArray = Array.from(Buffer.from(checkMarkWithColor))
      expect(asArray).toStrictEqual(expected)
    }
  })
  chalk.level = restoreChalkLevel
})

describe('show - happy path', () => {
  it('should show a validation', () => {
    const output: string[] = []
    const appendToOutput = (
      message: string,
      extra?: Record<string, string | number | boolean | string[]>
    ): void => {
      output.push(message)
    }
    const restoreChalkLevel = chalk.level
    chalk.level = 0
    const logSpy = vi.spyOn(console, 'log').mockImplementation(appendToOutput)
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(appendToOutput)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(appendToOutput)
    const validations: Validation[] = [
      {
        ok: true,
        level: 'info',
        message: 'All accounted for',
        extra: { total: 0, ignored: 0, audio: 0, unaccounted: [] },
      },
      {
        ok: false,
        level: 'warn',
        message: 'Have unaccounted for files',
        extra: {
          total: 0,
          ignored: 0,
          audio: 0,
          unaccounted: ['something.unexpected'],
        },
      },
    ]
    show('test-title', validations)
    expect(logSpy).toHaveBeenCalledWith('✕ test-title')
    expect(infoSpy).toHaveBeenCalledWith('  ✔: All accounted for', {
      audio: 0,
      ignored: 0,
      total: 0,
      unaccounted: [],
    })
    expect(warnSpy).toHaveBeenCalledWith('  ✕: Have unaccounted for files', {
      audio: 0,
      ignored: 0,
      total: 0,
      unaccounted: ['something.unexpected'],
    })
    expect(output).toMatchInlineSnapshot(`
      [
        "✕ test-title",
        "  ✔: All accounted for",
        "  ✕: Have unaccounted for files",
      ]
    `)
    logSpy.mockRestore()
    chalk.level = restoreChalkLevel
  })
})
