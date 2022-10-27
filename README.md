
# NxAudiobook

Pnpm monorepo with nx for orchestration.

## TODO

- [ ] test sortAudible
- [ ] rewrite hints
- [ ] split into libs audible, metadata (music/ffprobe)
- [ ] Node18 & native fetch
  - [ ] remove node-fetch
  - [ ] "@tsconfig/node18-strictest-esm/tsconfig.json"
- [ ] CI/CD

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
