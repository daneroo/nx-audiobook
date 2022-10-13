import * as colors from 'colors/safe';

import type { Validation } from './types';

export function show(title: string, validation: Validation[]): void {
  const ok = validation.every((a) => a.ok);
  console.log(`${checkMark(ok)} ${title}`);
  for (const a of validation) {
    const { ok, level, message, extra } = a;
    console[level](`  ${checkMark(ok)}: ${message}`, extra);
  }
}

export function checkMark(ok: boolean, withColor = true): string {
  if (withColor) {
    return ok ? colors.green('✔') : colors.red('✕');
  }
  return ok ? '✔' : '✕';
}