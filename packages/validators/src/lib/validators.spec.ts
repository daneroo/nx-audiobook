import { validateFilesAllAccountedFor } from './validators';

describe('validateFilesAllAccountedFor', () => {
  it('validate empty file list', () => {
    expect(validateFilesAllAccountedFor([])).toEqual({
      ok: true,
      level: 'info',
      message: 'All accounted for',
      extra: { total: 0, excluded: 0, audio: 0, unclassified: [] },
    });
  });
  it('validate 2 audio file list', () => {
    expect(
      validateFilesAllAccountedFor(['/path/file1.mp3', '/path/file1.mp3'])
    ).toEqual({
      ok: true,
      level: 'info',
      message: 'All accounted for',
      extra: { total: 2, excluded: 0, audio: 2, unclassified: [] },
    });
  });
  it('validate 2 audio file list with 2 known-name files', () => {
    expect(
      validateFilesAllAccountedFor([
        '/path/file1.mp3',
        '/path/file1.mp3',
        '/path/.DS_Store',
        '/path/MD5SUM',
      ])
    ).toEqual({
      ok: true,
      level: 'info',
      message: 'All accounted for',
      extra: { total: 4, excluded: 2, audio: 2, unclassified: [] },
    });
  });

  it('reject unknown file name (no extension)', () => {
    expect(
      validateFilesAllAccountedFor([
        '/path/file1.mp3',
        '/path/file1.mp3',
        '/path/README',
      ])
    ).toEqual({
      ok: false,
      level: 'warn',
      message: 'Have unclassified files',
      extra: {
        total: 3,
        excluded: 0,
        audio: 2,
        unclassified: ['/path/README'],
      },
    });
  });

  it('reject an unknown file extension', () => {
    expect(validateFilesAllAccountedFor(['/path/file.unknown'])).toEqual({
      ok: false,
      level: 'warn',
      message: 'Have unclassified files',
      extra: {
        total: 1,
        excluded: 0,
        audio: 0,
        unclassified: ['/path/file.unknown'],
      },
    });
  });
});
