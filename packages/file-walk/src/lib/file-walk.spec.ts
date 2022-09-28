import { getDirectories, getFiles } from './file-walk';
import { resolve } from 'node:path';

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
    expect(thisDirFiles).toContain(__filename);
  });
});
