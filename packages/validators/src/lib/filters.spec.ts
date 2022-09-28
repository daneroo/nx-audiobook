import { filterAudioFileExtensions } from './filters';

describe('filterAudioFileExtensions', () => {
  test.each([
    ['track.mp3', true],
    ['track.m4b', true],
    ['track.m4a', true],
    ['track.aa', false],
    ['track.aa', false],
    ['track.aax', false],
    ['README.md', false],
    ['track', false],
    ['mp3', false],
    ['.mp3', false],
  ])('%# filter %s: %p', (filePath, expected) => {
    expect(filterAudioFileExtensions(filePath)).toBe(expected);
  });
});
