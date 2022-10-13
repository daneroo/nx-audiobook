declare module '@root/walk' {
  import { Dirent } from 'node:fs';
  import { walk } from '@root/walk';

  type WalkFunc = (
    err?: Error | null,
    dirname: string,
    dirent: import('fs').Dirent
  ) => Promise<boolean | undefined>;

  function walk(
    pathname: string,
    func: WalkFunc,
    dirent?: Dirent
  ): Promise<boolean>;

  export { walk, WalkFunc };
}
