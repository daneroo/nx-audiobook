import { getDirectories, getFiles, File } from './file-walk';
import { resolve, basename, extname } from 'node:path';

// utility
function fileFromPath(filePath: string): File {
  return {
    path: filePath,
    basename: basename(filePath),
    extension: extname(filePath),
    size: 0,
    mtime: new Date(0),
  };
}

describe('getDirectories smoke test', () => {
  it('should read this directory and not have children', async () => {
    const selfDir = resolve(__dirname, '.');
    expect(await getDirectories(selfDir)).toEqual([__dirname]);
  });
  it("should read this directory's parent and only have itself and lib as a child", async () => {
    // assumes that lib ()
    const parentDir = resolve(__dirname, '..');
    expect(await getDirectories(parentDir)).toEqual([parentDir, __dirname]);
  });
});

describe('getFiles smoke test', () => {
  it('should read this directory and find this file', async () => {
    const selfDir = resolve(__dirname, '.');
    const thisDirFiles = await getFiles(selfDir);
    expect(thisDirFiles.map((f) => f.path)).toContain(__filename);
  });
});
