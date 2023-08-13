# Audiobookshelf

Audiobbokshelf Settings

- Create a daniel user (root for now)
- Internal backups 20:00 (keep 2) -
- VM Snapshots in proxmox at 21:00

## Operation

Run in docker on `plex-audiobook.imetrical.com`

```bash
docker compose up -d
```

Mounting these 3 directories:

- /Volumes/Reading/audiobooks/:/audiobooks:ro (SMB share from syno)
- ./data/metadata:/metadata
  - ./data/metadata/backups/YYYY_MM_DDTHHMM.audiobookshelf (zip files - keep 2)
- ./data/config:/config

## metadata and config dirs

- `config` dir only contains the sqlite database
- `metadata` contains log,caches,items covers,...
- `metadata/backups` contains backups (keeps 2)
  - `YYYY_MM_DDTHHMM.audiobookshelf` is just a zip file, containting:

```bash
$ unzip -l data/metadata/backups/2023-08-13T1942.audiobookshelf
Archive:  data/metadata/backups/2023-08-13T1942.audiobookshelf
  Length      Date    Time    Name
---------  ---------- -----   ----
       42  2023-08-13 19:42   details
  2088960  2023-08-13 19:42   absdatabase.sqlite
        0  2023-08-13 04:53   metadata-items/2798acfe-5231-4e66-9b11-d56c0c0a4ba9/
   403241  2023-08-13 04:53   metadata-items/2798acfe-5231-4e66-9b11-d56c0c0a4ba9/cover.jpg
.
.
        0  2023-03-04 04:52   metadata-items/li_27dgrl7tugqytdhabw/
    24108  2023-03-04 04:52   metadata-items/li_27dgrl7tugqytdhabw/cover.jpg
     4298  2023-03-04 04:52   metadata-items/li_27dgrl7tugqytdhabw/metadata.abs
.
.
```

## References

- [Audiobookshelf Site](https://www.audiobookshelf.org/)
- [GitHub](https://github.com/advplyr/audiobookshelf)
