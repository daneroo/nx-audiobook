
# NxAudiobook

Pnpm monorepo with nx for orchestration.

## TODO

- [ ] include `pnpx npm-check-updates` in top package.json and add target to each project
- [ ] integrate audiobookshelf into this repo, perhaps with/without plex-audiobook
- [ ] minimal front-end for verifying chapters
- [ ] convert with ffmpeg
  - mp3,m4b bitrate
  - chapter options
- [ ] refactor classify/convert
  - [ ] classifyDirectory (getCover)
  - [ ] getCoverImage in covert (should take audiobook, and consider coverFile)
  - move convertPerDirectory from index.ts
- [ ] split into libs audible, metadata (music/ffprobe)
- [ ] command for durations (comparisons):
  - augmentFileInfo has the stub of comparing ffprobe,music-metadata durations
- [ ] Node18 & native fetch - remove node-fetch
  - [ ] consider [unjs fetch](https://github.com/unjs/ohmyfetch)

## Operation

```bash
# nx run-many --target=XXX
pnpm lint
pnpm test
pnpm run coverage
pnpm build
pnpm build && pnpm start

# cd apps/validate
pnpm run dev # run's the cli in dev mode (i.e. with vite-node)

# For now, til we have better cli
# validate
time pnpm run dev --rewriteHintsDB src/app/hints/newdb.ts ; pnpm exec prettier --write src/app/hints/newdb.ts ; difft src/app/hints/*db.ts

# convert
time pnpm run dev -r '/Volumes/Space/archive/media/audiobooks/Steven Brust - Khaavren Romances/' --convertDir /Volumes/Space/Reading/convert

# Test the github action
act --secret-file nx-cloud.env -j unit
```

## Nx Cloud

Locally, `NX_CLOUD_ACCESS_TOKEN` is set in the `nx-cloud.env` file.
On Github, it is set in the repo's Actions secrets.

See [Nx Cloud docs for details](https://nx.dev/nx-cloud/account/access-tokens)

## New app or package

Take notes when we add the next one. Perhaps add a validator or generator.

## Durations

It turns out that the duration of an audio file (.mp3,.m4b,..) is evaluated the same by music-metadata and ffprobe.
Further Audible lookup rounds the duration to the nearest minute.

## References

- Alternatives
  - chalk -> [kolorist](https://github.com/marvinhagemeister/kolorist)
  - yargs -> [minimist](https://github.com/minimistjs/minimist)
