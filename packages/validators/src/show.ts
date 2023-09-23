import chalk from 'chalk'

import type { Validation } from './types'
export function show(
  title: string,
  validations: Validation[],
  verbosity = 0
): void {
  const { alwaysTitle, onlyFailures } = showOptionsFromVerbosity(verbosity)
  const ok = validations.every((a) => a.ok)

  if (alwaysTitle || !ok) {
    console.log(`${checkMark(ok)} ${title}`)
  }
  for (const v of validations) {
    const { ok, level, message, extra } = v
    if (!onlyFailures || !ok) {
      if (isEmpty(extra)) {
        console[level](`  ${checkMark(ok)} ${message}`)
      } else {
        console[level](`  ${checkMark(ok)} ${message}`, extra)
      }
    }
  }
}

function isEmpty(
  obj: Record<string, string | number | boolean | string[] | number[]>
): boolean {
  return Object.keys(obj).length === 0
}

export function checkMark(ok: boolean, withColor = true): string {
  if (withColor) {
    return ok ? chalk.green('✔') : chalk.red('✕')
  }
  return ok ? '✔' : '✕'
}

interface ShowOptions {
  alwaysTitle: boolean
  onlyFailures: boolean
}

function showOptionsFromVerbosity(verbosity: number): ShowOptions {
  switch (verbosity) {
    case 2:
      return { alwaysTitle: true, onlyFailures: false }
    case 1:
      return { alwaysTitle: true, onlyFailures: true }
    default:
      return { alwaysTitle: false, onlyFailures: true }
  }
}
