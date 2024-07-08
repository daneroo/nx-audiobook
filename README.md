# NxAudiobook

This repo consolidates audiobook management

- infra directory for (see [README.md](./infra/README.md) in each)

  - audiobookshelf: a standalone audiobook manager
  - plex-audiobook: a standalone plex agent for audiobooks

- validate/convert tooling (my own)
  - Pnpm monorepo with nx for orchestration.

## Dev/Staging Operations

**Note**: Move this to infra/README.md or infra/OPERATIONS.md (see infra/MIGRATION.md)

- start dev server
- validate locally
- sync to staging (galois:/Volumes/Reading/audiobooks)
- validate on staging
- sync to prod (syno) - and mirrors

### Operate the local/staging audiobookshelf

```bash
cd infra/audiobookshelf
just start
# open audiobookshelf in browser
open http://localhost:13378
open http://0.0.0.0:13378
# open the content directory
open data/audiobooks/
# open the Staging directory
open ~/Downloads/Staging/

# watch in container
just exec
apk add htop glances
watch 'find /metadata /audiobooks -mmin -30 -exec ls -lh {} \;'
watch 'find /metadata -name \*m4b -mmin -30 -exec ls -lh {} \;'

```

### Validate locally

```bash
alias tone=~/Downloads/tone-0.1.5-osx-arm64/tone

bitrate() {
    if [ "$#" -ne 1 ]; then
        echo "Usage: bitrate <filename>"
        return 1
    fi

    echo "Bitrate for: $(basename "$1")"
    echo "Tone: $(tone dump "$1" | grep 'bitrate')"
    echo "FFprobe: $(ffprobe -v error -select_streams a:0 -show_entries stream=bit_rate "$1" | grep 'rate')"
}
mod_time_utc() {
  local filename="$1"
  date -u -r $(stat -f "%m" "${filename}") +"%Y-%m-%dT%H:%M:%SZ"
}

cd apps/validate
time pnpm run dev --help
time pnpm run dev -r ../../infra/audiobookshelf/data/audiobooks/
# add to modTime.ts
time pnpm run dev -r ../../infra/audiobookshelf/data/audiobooks/ --mtime check
time pnpm run dev -r ../../infra/audiobookshelf/data/audiobooks/ --mtime fix

# convert to m4b - in local dev and watch in audiobookshelf docker container
just checkfiles
```

### Sync to Staging

```bash
# Dev to Staging
#  on galois, dev, sync to /Volumes/Reading/audiobooks
rsync -n -av -i --progress --exclude .DS_Store --exclude @eaDir ~/Code/iMetrical/nx-audiobook/infra/audiobookshelf/data/audiobooks/ /Volumes/Reading/audiobooks/

# Validate again
time pnpm run dev -r /Volumes/Reading/audiobooks/
time pnpm run dev -r /Volumes/Reading/audiobooks/ --mtime check

just checkfiles
```

### Sync to Prod - and mirrors

```bash
# Staging to Prod **FROM Syno**
# on syno, pull from galois (Staging)
rsync -n -av -i --progress --exclude .DS_Store --exclude @eaDir galois.imetrical.com:/Volumes/Reading/audiobooks/ /volume1/Reading/audiobooks/

# Manual scan from audiobookshelf (prod)
open https://audiobook.dl.imetrical.com/

# Pull a copy from mirrors (till syncthing is setup)
# on shannon,davinci (NOT yet/or ever dirac,feynman) pull from galois (Staging)
rsync -n -av -i --progress --exclude .DS_Store --exclude @eaDir galois.imetrical.com:/Volumes/Reading/audiobooks/ /Volumes/Reading/audiobooks/

```

## TODO

- [ ] Upgrade to v2.5.0
- [ ] validate
  - [ ] convert fixModTime.. into validations (with a fix param?) - remove fixModTimeHintPerDirectory
  - [x] mtime for parent dir
  - [ ] mtime for other files (.epub, cover.jpg)
  - [ ] mtime for grandparent dir(s)
  - [ ] add a --mtime write option ( .json5 database, checked in `hints/mtimehints.json5`)
  - [ ] add a validation (global) that the mtime hints are complete / and no hints are unused
  - [ ] add a file naming validations - char sets, author - series - title...
- [ ] Cleanup PROGRESS / MIGRATION / MODTIME
- [ ] Remove or Verify usage of convertDirectory
- [ ] README.md ## Operations i.e. WORKFLOW (new) Justfile
- [ ] minimal front-end for verifying chapters
  - [ ] restart with Astro? if so remove view-t3
  - [ ] t3-app <https://github.com/t3-oss/create-t3-app>
    - `pnpm create t3-app@latest`
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

## Infra - Operations

- [README.md](./infra/README.md)

## Nx - Operation

for updates:

```bash
pnpm update --recursive --interactive
# Use the --latest option to update the ranges in package.json

# or
# pnpx npm-check-updates was also considered
```

```bash
# nx run-many --target=XXX
pnpm lint
pnpm test
pnpm run coverage
pnpm build
pnpm build && pnpm start

# cd apps/validate -
# # run's the cli in dev mode (i.e. with vite-node)
pnpm run dev --help
pnpm run dev

# For now, til we have better cli
# cd apps/validate
# TODO(daneroo): add a --mtime write option
time pnpm run dev --mtime write ; pnpm exec prettier --write src/app/hints/mtimehints.json ; difft src/app/hints/mtime*.json

# progress
cd apps/validate
# clean output into PROGRESS.md
pnpm vite-node src/index.ts --  --progressDir /Volumes/Reading/audiobooks | tee ../../infra/PROGRESS.md
time pnpm run dev --progressDir /Volumes/Reading/audiobooks

# convert
time pnpm run dev -r '/Volumes/Space/archive/media/audiobooks/Steven Brust - Khaavren Romances/' --convertDir /Volumes/Space/Scratch/convert
time pnpm run dev -r '/Volumes/Space/archive/media/audiobooks/Steven Erikson - The Malazan Book of the Fallen/' --convertDir /Volumes/Space/Scratch/convert

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
Further, Audible lookup rounds the duration to the nearest minute.

## References

- Alternatives
  - chalk -> [kolorist](https://github.com/marvinhagemeister/kolorist)
  - yargs -> [minimist](https://github.com/minimistjs/minimist)
