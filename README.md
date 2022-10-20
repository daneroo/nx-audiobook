
# NxAudiobook

Pnpm monorepo with nx for orchestration.

## TODO

- [ ] Migrate a functioning version of validate-audiobook/walk
- [ ] Add tests to metadata
- [ ] CI/CD

## Operation

```bash
# nx run-many --target=XXX
pnpm lint
pnpm test
pnpm build

# cd apps/validate
pnpm run dev # run's the cli in dev mode (i.e. with vite-node)
```

## New app or package

Take notes when we add the next one. Perhaps add a validator or generator.

## References

- Alternatives
  - chalk -> [kolorist](https://github.com/marvinhagemeister/kolorist)
  - yargs -> [minimist](https://github.com/minimistjs/minimist)
