# Migration to pnpm workspaces

Following the model of <https://github.com/daneroo/nx-cli-in-anger>,
move this repo to pnpm workspaces.

- pnpm

## pnpm workspace

- [ ] pnpm-workspace.yaml
- [ ] package.json top - devDeps but no deps
- [ ] `package.json` per project - no devDependencies
  - [x] file-walk

## tsx

- [ ] `tsconfig{''|.build|.eslint}.json` in top
  - add paths for each project
- [ ] `tsconfig.json` in each package
  - [x] file-walk
  - [x] time
  - [x] validators

## vitest

- [ ] `vitest.config.ts` in top
- [ ] `vitest.config.ts` in each package
  - [x] file-walk

## eslint + prettier

- [x] `.eslintrc.cjs` in top
- [x] `.prettierrc` in top
- [x] `.prettierignore` in top
- [x] `.editorconfig` in top (kept the on from nx)

## nx

- [ ] `nx.json` in top