import chalk from 'chalk'

import type { Validation } from './types'
interface ShowOptions {
  alwaysTitle: boolean
  onlyFailures: boolean
}
export function show(
  title: string,
  validation: Validation[],
  options: ShowOptions = {
    alwaysTitle: true,
    onlyFailures: false,
  }
): void {
  const { alwaysTitle, onlyFailures } = options
  const ok = validation.every((a) => a.ok)

  if (alwaysTitle || !ok) {
    console.log(`${checkMark(ok)} ${title}`)
  }
  for (const v of validation) {
    const { ok, level, message, extra } = v
    if (onlyFailures && !ok) {
      console[level](`  ${checkMark(ok)}: ${message}`, extra)
    }
  }
}

export function checkMark(ok: boolean, withColor = true): string {
  if (withColor) {
    return ok ? chalk.green('✔') : chalk.red('✕')
  }
  return ok ? '✔' : '✕'
}
