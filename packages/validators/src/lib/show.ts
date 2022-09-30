import * as colors from 'colors/safe';
import { Advice } from './types';

export function show(title: string, advice: Advice[]) {
  const ok = advice.every((a) => a.ok);
  console.log(`${checkMark(ok)} ${title}`);
  for (const a of advice) {
    const { ok, level, message, extra } = a;
    console[level](`  ${checkMark(ok)}: ${message}`, extra);
  }
}

export function checkMark(ok: boolean, withColor = true) {
  if (withColor) {
    return ok ? colors.green('✔') : colors.red('✕');
  }
  return ok ? '✔' : '✕';
}
