import { validateFilesAllAccountedFor } from './validators';
import { FileInfo } from '@nx-audiobook/file-walk';
import { basename, extname } from 'node:path';

// utility
function fileInfoFromPath(filePath: string): FileInfo {
  return {
    path: filePath,
    basename: basename(filePath),
    extension: extname(filePath),
    size: 0,
    mtime: new Date(0),
  };
}

describe('validateFilesAllAccountedFor', () => {
  it('validate empty file list', () => {
    expect(validateFilesAllAccountedFor([])).toEqual({
      ok: true,
      level: 'info',
      message: 'All accounted for',
      extra: { total: 0, ignored: 0, audio: 0, unclassified: [] },
    });
  });
  it('validate 2 audio file list', () => {
    expect(
      validateFilesAllAccountedFor(
        ['/path/file1.mp3', '/path/file1.mp3'].map(fileInfoFromPath)
      )
    ).toEqual({
      ok: true,
      level: 'info',
      message: 'All accounted for',
      extra: { total: 2, ignored: 0, audio: 2, unclassified: [] },
    });
  });
  it('validate 2 audio file list with 2 known-name files', () => {
    expect(
      validateFilesAllAccountedFor(
        [
          '/path/file1.mp3',
          '/path/file1.mp3',
          '/path/.DS_Store',
          '/path/MD5SUM',
        ].map(fileInfoFromPath)
      )
    ).toEqual({
      ok: true,
      level: 'info',
      message: 'All accounted for',
      extra: { total: 4, ignored: 2, audio: 2, unclassified: [] },
    });
  });

  it('reject unknown file name (no extension)', () => {
    expect(
      validateFilesAllAccountedFor(
        ['/path/file1.mp3', '/path/file1.mp3', '/path/README'].map(
          fileInfoFromPath
        )
      )
    ).toEqual({
      ok: false,
      level: 'warn',
      message: 'Have unclassified files',
      extra: {
        total: 3,
        ignored: 0,
        audio: 2,
        unclassified: ['/path/README'],
      },
    });
  });

  it('reject an unknown file extension', () => {
    expect(
      validateFilesAllAccountedFor(['/path/file.unknown'].map(fileInfoFromPath))
    ).toEqual({
      ok: false,
      level: 'warn',
      message: 'Have unclassified files',
      extra: {
        total: 1,
        ignored: 0,
        audio: 0,
        unclassified: ['/path/file.unknown'],
      },
    });
  });
});
