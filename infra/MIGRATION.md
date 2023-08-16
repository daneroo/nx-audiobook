# Migration

We wish to move all content of our _Legacy_ audiobook library to our _Reading_ library.

Current [PROGRESS.md](./PROGRESS.md)

## Iteration

- Fine-tune audiobook in this audiobookshelf dev env (galois)
- Sync to /Volumes/Space/Reading/audiobooks on galois (syncthing to davinci,..)
- Sync to syno:/Reading/audiobooks on davinci

```bash
# Dev to Staging
#  on galois, dev, sync to /Volumes/Space/Reading/audiobooks
rsync -n -av -i --progress --exclude .DS_Store --exclude @eaDir ~/Code/iMetrical/nx-audiobook/infra/audiobookshelf/data/audiobooks/ /Volumes/Space/Reading/audiobooks/

# Staging to Prod
# on syno, pull from galois (Staging)
rsync -n --delete -av -i --progress --exclude .DS_Store --exclude @eaDir galois.imetrical.com:/Volumes/Space/Reading/audiobooks/ /volume1/Reading/audiobooks/
```

## TODO

- Idea: use [tone](https://github.com/sandreas/tone) to extract uniform data from all media files
  - `tone` has a NixPkgs package (fleek/home-manager?)
  - Perhaps as with directory-digests on multiple machines
  - See [Tone Dump](#tone-dump) below
- Syncthing for `/Volumes/Reading/` on galois and davinci, at least
- Rsync back to syno, from [galois|davinci] (syncthing on Synology doesn't look like a good idea)
- Borgbackup: from ?

## Current State

| Name                                | Description                                                       |
| ----------------------------------- | ----------------------------------------------------------------- |
| Legacy                              | Source for migration                                              |
| `$ARCHIVE_HOME/media/audiobooks`    | on syno,galois,davinci,dirac,shannon                              |
| Canonical New                       |                                                                   |
| `/Volumes/Space/Reading/audiobooks` | Source of truth, [Syncthing on galois, [davinci, dirac, shannon]] |
| `syno:Reading/audiobooks`           | Source for Audiobookshelf and Plex on audiobook VM                |
| `./data/audiobooks`                 | Developer view in this repo                                       |

## Normalization

Normalization of audiobook files implies:

- Normalizing all content
  - from `/Volumes/Space/archive/media/audiobooks/`
  - to `/Volumes/Reading/audiobooks/`
- Standard tags for author,title, but also narrator, translator,series, seriesIndex, etc.
- Should be compatible with Audiobookshelf as well as Plex Audiobook agent
- Should preserve modification times of legacy directories and files, to reflect acquisition date, as a proxy for reading date.

## Tone Dump

Tone has a bad serialization format which adds `\n\r` inside strings which makes it malformed JSON.
We can see this in the way that [node-tone](https://github.com/advplyr/node-tone/) (by the audiobookshelf author) parses the output of `tone dump`:

```js
return JSON.parse(response.replace(/[\n\r]+/g, ' ')) // Remove carriage returns`
```

We can do the same from the command line with `tr -d '\n\r'` as in:

```bash
tone dump  /Volumes/Space/archive/media/audiobooks/ --format json | tr -d '\n\r' | jq
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
