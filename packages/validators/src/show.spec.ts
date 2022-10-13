import { describe, expect, test } from 'vitest';
import { checkMark } from './show';

describe('checkMark - no color', () => {
  test.each([
    [true, '✔'],
    [false, '✕'],
  ])('%# checkMark %p: %p', (bool, expected) => {
    const withColor = false;
    expect(checkMark(bool, withColor)).toBe(expected);
  });
});

describe('checkMark - with color', () => {
  test.each([
    [true, [27, 91, 51, 50, 109, 226, 156, 148, 27, 91, 51, 57, 109]],
    [false, [27, 91, 51, 49, 109, 226, 156, 149, 27, 91, 51, 57, 109]],
  ])('%# checkMark %p: %p', (bool, expected) => {
    const withColor = true;
    const checkMarkWithColor: string = checkMark(bool, withColor);
    const asArray = Array.from(Buffer.from(checkMarkWithColor));
    expect(asArray).toStrictEqual(expected);
  });
});
