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

export function validateFilesAllAccountedFor(files: FileInfo[]): Validation {
  const filenames = files.map((file) => file.path);

  const excludedFilenames = filenames.filter(filterNonAudioExtensionsOrNames);
  const audioFiles = filenames.filter(filterAudioFileExtensions);

  const unclassified = filenames.filter((filePath) => {
    if (filterAudioFileExtensions(filePath)) return false;
    if (filterNonAudioExtensionsOrNames(filePath)) return false;
    return true;
  });
  const ok = unclassified.length === 0;

  const extra = {
    total: files.length,
    audio: audioFiles.length,
    ignored: excludedFilenames.length,
    unclassified: unclassified,
  };

  const validation: Validation = {
    ok,
    level: ok ? 'info' : 'warn',
    message: ok ? 'All accounted for' : 'Have unclassified files',
    extra,
  };
  return validation;
}
