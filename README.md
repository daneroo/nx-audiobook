
# NxAudiobook

Pnpm monorepo with nx for orchestration.

## TODO

- [ ] split into libs audible, metadata (music/ffprobe)
- [ ] command for durations:
  - augmentFileInfo has the stub of comparing ffprobe,music-metadata durations
- [ ] CI/CD
- [ ] Node18 & native fetch - remove node-fetch

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
time pnpm run dev --rewriteHintsDB src/app/hints/newdb.ts ; pnpm exec prettier --write src/app/hints/newdb.ts ; difft src/app/hints/*db.ts
```

## New app or package

Take notes when we add the next one. Perhaps add a validator or generator.

## Durations

It turns out that the duration of an audio file (.mp3,.m4b,..) is evaluated the same by music-metadata and ffprobe.
Further Audible lookup rounds the duration to the nearest minute.

## References

- Alternatives
  - chalk -> [kolorist](https://github.com/marvinhagemeister/kolorist)
  - yargs -> [minimist](https://github.com/minimistjs/minimist)
