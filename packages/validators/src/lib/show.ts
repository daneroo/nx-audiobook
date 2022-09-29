import { Advice } from './types';
// import * as chalk from 'chalk';

export function show(title: string, advice: Advice[]) {
  const ok = advice.every((a) => a.ok);
  console.log(`${checkMark(ok)} ${title}`);
  for (const a of advice) {
    const { ok, level, message, extra } = a;
    console[level](`  ${checkMark(ok)}: ${message}`, extra);
  }
}

function checkMark(ok: boolean) {
  return ok ? '✔' : '✕';
  // return ok ? chalk.green('✔') : chalk.red('✕');
}
