declare module '@root/walk' {
  import type { Dirent } from 'node:fs'
  import { walk } from '@root/walk'

  type WalkFunc = (
    err?: Error | null,
    dirname: string,
    dirent: Dirent
  ) => Promise<boolean | undefined>

  function walk(
    pathname: string,
    func: WalkFunc,
    dirent?: Dirent
  ): Promise<boolean>

  export { walk, type WalkFunc }
}
