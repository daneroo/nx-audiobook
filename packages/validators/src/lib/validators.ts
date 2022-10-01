import { Validation } from './types';

import {
  filterAudioFileExtensions,
  // filterNonAudioFileExtensions,
  filterNonAudioExtensionsOrNames,
  // filterNonAudioFilenames,
} from './filters';
import { File } from '@nx-audiobook/file-walk';

// for filenames in a set (typically a directory),
// verify that all extensions (and some known filenames are accounted for)
// simply console.error the unaccounted for files files.
export function validateFilesAllAccountedFor(files: File[]): Validation {
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
    total: filenames.length,
    excluded: excludedFilenames.length,
    audio: audioFiles.length,
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
