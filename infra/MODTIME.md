# Modtime preservation

- We are likely to have to keep a database of hints for preserving the modTimes of files..
- We can use the `touch` command to set the modtime of a file to the current time.

## List all .m4b files in a directory inverse sorted by modtime

```bash
# MacOS with gls - gnu ls
find /Volumes/Space/Reading/audiobooks -name "*m4b" -print0 | xargs -0 gls -l --time-style=full-iso | sort -r -k6,7
# in audiobookshelf ash shell
find /audiobooks -name "*m4b" -print0 | xargs -0 ls -lt --full-time | sort -r -k6,7
```

## touch

```bash
touch -r reference-file file-to-modify
# set the modtime of a file with an explicit date: yyyy-mm-dd hh:mm:ss
# The argument is of the form “[[CC]YY]MMDDhhmm[.SS]”
# e.g. 2020-09-25 10:05:16 ./attack_surface_sq.jpg
touch -t 202009251005.16 ./attack_surface_sq.jpg

```

## iso 8601 listing of files (with directory) and sort

```bash
find . -maxdepth 1 -print0 | xargs -0 stat -f "%m|%Sm|%N" -t "%Y-%m-%d %H:%M:%S|%Y%m%d%H%M.%S" | sort -n -t "|" -k1,1 | awk -F "|" '{print $2, "   ", $3, $4}'
```

```txt
# example output
2021-09-25 01:25:34     202109250125.34 ./Cover.jpg
2021-09-25 18:15:37     202109251815.37 ./Histories - Part 001.mp3
2021-09-25 18:15:37     202109251815.37 ./Histories - Part 002.mp3
```
