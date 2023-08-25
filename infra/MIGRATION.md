# Migration

We wish to move all content of our _Legacy_ audiobook library to our _Reading_ library.

Current [PROGRESS.md](./PROGRESS.md) - (generated)

## TODO

- [x] Dropbox - CurrentlyReading
- [ ] Dropbox - OnDeck
- [ ]NewNotAdded (~/Downloads)

### Stretch

- Idea: use [tone](https://github.com/sandreas/tone) to extract uniform data from all media files
  - `tone` has a NixPkgs package (fleek/home-manager?)
  - Perhaps as with directory-digests on multiple machines
  - See [Tone Dump](#tone-dump) below
- Syncthing for `/Volumes/Reading/` on galois and davinci, at least
- Rsync back to syno, from [galois|davinci] (syncthing on Synology doesn't look like a good idea)
- Borgbackup: from ?

## Iteration

- Fine-tune audiobook in this audiobookshelf dev env (galois)
- Sync to /Volumes/Reading/audiobooks on galois (syncthing to davinci,..)
- Sync to syno:/Reading/audiobooks on davinci

```bash

## Permissions dirs 755, files 644
# Show Bad Perms
find audiobooks/ -not -perm 644 -type f -exec ls -l {} \;
find audiobooks/ -not -perm 755 -type d -exec ls -ld {} \;
# Fix Perms
find audiobooks/ -type d -exec chmod 755 {} \;
find audiobooks/ -type f -exec chmod 644 {} \;

# Show unneeded files
find audiobooks/ -type f -not -name \*m4b -not -name cover.jpg -not -name \*.epub -not -name .DS_Store | wc -l

# Dev to Staging
#  on galois, dev, sync to /Volumes/Reading/audiobooks
rsync -n -av -i --progress --exclude .DS_Store --exclude @eaDir ~/Code/iMetrical/nx-audiobook/infra/audiobookshelf/data/audiobooks/ /Volumes/Reading/audiobooks/

cd apps/validate
# clean output into PROGRESS.md
pnpm vite-node src/index.ts --  --progressDir /Volumes/Reading/audiobooks | tee ../../infra/PROGRESS.md


# Staging to Prod
# on syno, pull from galois (Staging)
rsync -n -av -i --progress --exclude .DS_Store --exclude @eaDir galois.imetrical.com:/Volumes/Reading/audiobooks/ /volume1/Reading/audiobooks/

```

## Current State

| Name                             | Description                                                       |
| -------------------------------- | ----------------------------------------------------------------- |
| Legacy                           | Source for migration                                              |
| `$ARCHIVE_HOME/media/audiobooks` | on syno,galois,davinci,dirac,shannon                              |
| Canonical New                    |                                                                   |
| `/Volumes/Reading/audiobooks`    | Source of truth, [Syncthing on galois, [davinci, dirac, shannon]] |
| `syno:Reading/audiobooks`        | Source for Audiobookshelf and Plex on audiobook VM                |
| `./data/audiobooks`              | Developer view in this repo                                       |

## Normalization

Normalization of audiobook files implies:

- Normalizing all content
  - from `/Volumes/Space/archive/media/audiobooks/`
  - to `/Volumes/Reading/audiobooks/`
- Standard tags for author,title, but also narrator, translator,series, seriesIndex, etc.
- Should be compatible with Audiobookshelf as well as Plex Audiobook agent
- Should preserve modification times of legacy directories and files, to reflect acquisition date, as a proxy for reading date.

## Corrupt files

Many books (Flashman, Saxon Chronicles) had a strange encoding that prevented tone from embedding it's tags:

Using ffmpeg to pass-through the streams seemed to fix things

```bash
cp file.m4b file.orig.m4b

ffmpeg -y -loglevel quiet -i orig.m4b -c copy fixed.m4b
# in on case we had to remove a stream (stream 1 [0-indexed])
ffmpeg -y -loglevel quiet -i orig.m4b -c copy -map 0:0 -map 0:2 fixed.m4b

# other options
ffmpeg -i input.m4b -c:a copy output.m4b
ffmpeg -i input.m4b -c:a aac -b:a 128k output.m4b

```

## Tone Dump

Tone has a bad serialization format which adds `\n\r` inside strings which makes it malformed JSON.
We can see this in the way that [node-tone](https://github.com/advplyr/node-tone/) (by the audiobookshelf author) parses the output of `tone dump`:

```js
return JSON.parse(response.replace(/[\n\r]+/g, ' ')) // Remove carriage returns`
```

We can do the same from the command line with `tr -d '\n\r'` as in:

```bash
alias tone=~/Downloads/tone-0.1.5-osx-arm64/tone
tone dump  /Volumes/Space/archive/media/audiobooks/ --format json | tr -d '\n\r' | jq

# without the embeddedPictures or chapters
tone dump audiobooks/ --format json | tr -d '\n\r' | jq '.meta | del(.embeddedPictures)'
tone dump audiobooks/ --format json | tr -d '\n\r' | jq '.meta | del(.embeddedPictures) | del(.chapters)'
```

```bash
# on MacOS
xattr -d com.apple.quarantine ~/Downloads/tone-0.1.5-osx-arm64/tone
alias tone=~/Downloads/tone-0.1.5-osx-arm64/tone

# remove large fields from meta
tone dump  /Volumes/Space/archive/media/audiobooks/ --format json --exclude-property embeddedPictures --exclude-property comment --exclude-property description | tr -d '\n\r' | jq

# just title author, from meta
tone dump  /Volumes/Space/archive/media/audiobooks/ --format json --include-property title --include-property artist | tr -d '\n\r' | jq .meta

# from inside audiobookshelf container
tone dump /audiobooks/ --format json --exclude-property embeddedPictures --exclude-property comment --exclude-property description| tr -d '\n\r'| jq
```

## Validating Tone Writeability

Some files are not writeable by tone, and we need to fix that.

Here is a test script that will copy the file to a temporary location, and then run tone on it.

```bash
alias tone=~/Downloads/tone-0.1.5-osx-arm64/tone
find . -type f -name "*.m4b" | while IFS= read -r file_in_question; do
    cp "$file_in_question" /tmp/book.m4b
    echo "Testing ${file_in_question}"
    # your test operations here
    # tone dump /tmp/book.m4b --format json | tr -d '\n\r' | jq '.meta | del(.embeddedPictures) | del(.chapters)'
    tone dump /tmp/book.m4b --format json | tr -d '\n\r' | jq '.meta.album'
    # ffmpeg -y -loglevel quiet -i /tmp/book.m4b -c copy ${file_in_question}

done
```

## Logged Errors to investigate

```bash
ffprobe -hide_banner -loglevel fatal -show_error -show_format -show_streams -show_programs -show_chapters -show_private_data -print_format json
```

```bash
[2023-08-19 22:44:16] ERROR: [MediaFileScanner] TypeError: Cannot read properties of null (reading 'bit_rate') : "/audiobooks/Alastair Reynolds - Revelation Space/Alastair Reynolds - Revelation Space 04 - Absolution Gap/Alastair Reynolds - Revelation Space 04 - Absolution Gap.m4b" (MediaFileScanner.js:65)
[2023-08-19 22:44:17] ERROR: [MediaFileScanner] TypeError: Cannot read properties of null (reading 'bit_rate') : "/audiobooks/Alastair Reynolds - Revelation Space/Alastair Reynolds - Revelation Space 03 - Redemption Ark/Alastair Reynolds - Revelation Space 03 - Redemption Ark.m4b" (MediaFileScanner.js:65)
```
