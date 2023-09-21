import { describe, expect, it } from 'vitest'
import { getDirectories, getFiles, getDirectory } from './file-walk'
import { resolve } from 'node:path'

describe('getDirectories smoke test', () => {
  it('should read this directory and not have children', async () => {
    const selfDir = resolve(__dirname, '.')
    expect(await getDirectories(selfDir)).toEqual([__dirname])
  })
  it("should read this directory's parent and find the parent and this directory", async () => {
    // assumes that lib ()
    const parentDir = resolve(__dirname, '..')
    expect(await getDirectories(parentDir)).toContain(parentDir)
    expect(await getDirectories(parentDir)).toContain(__dirname)
  })
})

describe('getFiles smoke test', () => {
  it('should read this directory and find this file', async () => {
    const selfDir = resolve(__dirname, '.')
    const thisDirFiles = await getFiles(selfDir)
    expect(thisDirFiles.map((f) => f.path)).toContain(__filename)
  })
})

describe('getDirectory smoke test', () => {
  it('should read this directory and find this file', async () => {
    const selfDir = resolve(__dirname, '.')
    const thisDirFile = await getDirectory(selfDir)
    expect(thisDirFile.path).toEqual(__dirname)
  })
})
