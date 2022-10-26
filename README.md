
# NxAudiobook

Pnpm monorepo with nx for orchestration.

## TODO

- [ ] test sortAudible
- [ ] split audible, metadata (music/ffprobe)
- [ ] Node18 & native fetch (remove node-fetch)
- [ ] CI/CD

## Operation

```bash
# nx run-many --target=XXX
pnpm lint
pnpm test
pnpm build
pnpm build && pnpm start

# cd apps/validate
pnpm run dev # run's the cli in dev mode (i.e. with vite-node)
```

## New app or package

Take notes when we add the next one. Perhaps add a validator or generator.

## References

- Alternatives
  - chalk -> [kolorist](https://github.com/marvinhagemeister/kolorist)
  - yargs -> [minimist](https://github.com/minimistjs/minimist)
