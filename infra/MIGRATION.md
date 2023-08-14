# Migration

We wish to move all content of our _Legacy_ audiobook library to our _Reading_ library.

## TODO

- Idea: use [tone](https://github.com/sandreas/tone) to extract uniform data from all meda files
  - `tone` has a NixPkgs package (fleek/home-manager?)
  - Perhaps as with directory-digests on multiple machines
  - See [Tone Dump](#tone-dump) below
- Syncthing for `/Volumes/Reading/` on galois and davinci, at least
- Rsync back on syno, from there (syncthing on Synology doesn't look like a good idea)
- Borgbackup: from ?

## Current State

- Audiobookshelf and Plex both ser content from `syno:Reading/audiobooks` (SMB)
  - mounted as `/Volumes/Reading/audiobooks` on plex-audiobook VM on hilbert
    - further mounted as `/audiobooks` in Audiobookshelf container

## Progress

Progressive conversion, which means living with a state where we can establish

- What the current state of progress is: n of m done
- [ ] How can we match legacy directories to new directories?

## Normalization

Normalization of audiobook files implies:

- Normalizing all content
  - from `/Volumes/Space/archive/media/audiobooks/`
  - to `/Volumes/Reading/audiobooks/`
- Standard tags for author,title, but also narattor, translator,series, seriesIndex, etc.
- Should be compatible with Audiobookshelf as well as Plex Audiobook agent
- Should preserve modification times of legacy direcotires and files, to reflect acquisition date, as a proxy for reading date.

## Tone Dump

Tone has a bad serialization format which adds `\n\r` inside strings which makes it malformed JSON.
We can see this in the way that [node-tone](https://github.com/advplyr/node-tone/) (byt thae audiobookshelf author) parses the output of `tone dump`:

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
