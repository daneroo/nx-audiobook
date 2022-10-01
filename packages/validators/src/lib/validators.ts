import { Validation } from './types';

import {
  filterAudioFileExtensions,
  // filterNonAudioFileExtensions,
  filterNonAudioExtensionsOrNames,
  // filterNonAudioFilenames,
} from './filters';
import { FileInfo } from '@nx-audiobook/file-walk';

// for files in a set (typically a directory),
// verify that all extensions (and some known filenames are accounted for)
// simply console.error the unaccounted for files files.
// three inputs options:
//  audio file extensions: e.g. ['.mp3', '.m4b', '.m4a']
//  ignored (known, non-audio) file extensions: e.g. ['.jpeg', '.jpg', '.JPG', '.gif', '.png', '.pdf', '.cue', '.epub', '.txt', '.nfo', '.mobi', '.m3u', '.rtf']
//  ignored (known, non-audio) filenames: e.g. ['.DS_Store', 'MD5SUM']

const audioExtensions = ['.mp3', '.m4b', '.m4a'];
const ignoredExtensions = [
  '.jpeg',
  '.jpg',
  '.JPG',
  '.gif',
  '.png',
  '.pdf',
  '.cue',
  '.epub',
  '.txt',
  // '.nfo',
  '.mobi',
  '.m3u',
  '.rtf',
];
const ignoredFilenames = ['.DS_Store', 'MD5SUM'];

export function validateFilesAllAccountedFor(files: FileInfo[]): Validation {
  const filenames = files.map((file) => file.path);

  // count ignored files
  const ignored = files.filter((fileInfo) => {
    return (
      ignoredFilenames.includes(fileInfo.basename) ||
      ignoredExtensions.includes(fileInfo.extension)
    );
  }).length;

  // count audio files
  const audio = files.filter((fileInfo) =>
    audioExtensions.includes(fileInfo.extension)
  ).length;
  // filenames.filter(filterAudioFileExtensions);

  // the actual list of unaccounted for files (not audio , not ignored (ext or basename))
  const unaccounted = files
    .filter((fileInfo) => {
      // *not* (audio or  ignored (ext or basename))
      return !(
        audioExtensions.includes(fileInfo.extension) ||
        ignoredFilenames.includes(fileInfo.basename) ||
        ignoredExtensions.includes(fileInfo.extension)
      );
    })
    // now extract the path
    .map((fileInfo) => fileInfo.path);
  const ok = unaccounted.length === 0;

  const extra = {
    total: files.length,
    audio,
    ignored,
    unaccounted,
  };

  const validation: Validation = {
    ok,
    level: ok ? 'info' : 'warn',
    message: ok ? 'All accounted for' : 'Have unaccounted for files',
    extra,
  };
  return validation;
}
