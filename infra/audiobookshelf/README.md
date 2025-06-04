# Audiobookshelf

Audiobookshelf Settings

- Create a daniel user (root for now)
- Internal backups 20:00 (keep 7) -
- VM Snapshots in proxmox at 21:00

## Operation

Run in docker on `plex-audiobook.imetrical.com`

```bash
docker compose up -d
```

**Careful**: (some) files will be created as root in these directories...

Mounting these 3 directories:

- /Volumes/Space/Reading/audiobooks/:/audiobooks:ro (SMB share from syno)
- ./data/metadata:/metadata
  - ./data/metadata/backups/YYYY_MM_DDTHHMM.audiobookshelf (zip files - keep 2)
- ./data/config:/config

## metadata and config dirs

- `config` dir only contains the sqlite database
- `metadata` contains log,caches,items covers,...
- `metadata/backups` contains backups (keeps 7)
  - `YYYY-MM-DDTHHMM.audiobookshelf` is just a zip file, containing:

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

## Restoring a streak

These are the sqlite commands to show playback sessions and restore a broken listening streak by moving a session back in time.

```bash
# Install sqlite in the container:
docker compose exec audiobookshelf ash -c "apk add sqlite"

# Query recent sessions from last 3 days to identify gaps/targets (with table formatting)
docker compose exec audiobookshelf ash -c "sqlite3 /config/absdatabase.sqlite \".headers on\" \".mode table\" \"SELECT displayTitle, displayAuthor, date, dayOfWeek, timeListening, currentTime, updatedAt, createdAt FROM playbackSessions WHERE date >= date('now', '-3 days') ORDER BY updatedAt DESC;\""

# example output
+----------------+-----------------+------------+-----------+---------------+-------------+--------------------------------+--------------------------------+
|  displayTitle  |  displayAuthor  |    date    | dayOfWeek | timeListening | currentTime |           updatedAt            |           createdAt            |
+----------------+-----------------+------------+-----------+---------------+-------------+--------------------------------+--------------------------------+
| The Devils     | Joe Abercrombie | 2025-06-04 | Wednesday | 1213          | 15784.509   | 2025-06-04 05:37:34.130 +00:00 | 2025-06-04 05:15:02.244 +00:00 |
| The Devils     | Joe Abercrombie | 2025-06-04 | Wednesday | 2482          | 13841.688   | 2025-06-04 05:14:53.571 +00:00 | 2025-06-04 04:30:11.823 +00:00 |
| Apple in China | Patrick McGee   | 2025-06-03 | Tuesday   | 7427          | 15096.132   | 2025-06-03 00:38:05.059 +00:00 | 2025-06-02 22:16:51.496 +00:00 |
| The Devils     | Joe Abercrombie | 2025-06-02 | Monday    | 3758          | 9860.351    | 2025-06-02 05:39:51.422 +00:00 | 2025-06-02 04:31:50.665 +00:00 |
| The Devils     | Joe Abercrombie | 2025-06-01 | Sunday    | 1512          | 3829.416    | 2025-06-01 07:48:42.746 +00:00 | 2025-06-01 06:27:08.037 +00:00 |
+----------------+-----------------+------------+-----------+---------------+-------------+--------------------------------+--------------------------------+

# Move a session back 24 hours using only updatedAt as identifier (simpler/more reusable):
# WORKFLOW: 
# 1. Run the SELECT above to see recent sessions
# 2. Identify which session to move (look for gaps or duplicates on same day)
# 3. Copy the updatedAt timestamp from that session
# 4. Paste it into the WHERE clause below

docker compose exec audiobookshelf ash -c "sqlite3 /config/absdatabase.sqlite \"UPDATE playbackSessions SET updatedAt = datetime(updatedAt, '-24 hours'), createdAt = datetime(createdAt, '-24 hours'), date = date(updatedAt, '-24 hours'), dayOfWeek = CASE strftime('%w', date(updatedAt, '-24 hours')) WHEN '0' THEN 'Sunday' WHEN '1' THEN 'Monday' WHEN '2' THEN 'Tuesday' WHEN '3' THEN 'Wednesday' WHEN '4' THEN 'Thursday' WHEN '5' THEN 'Friday' WHEN '6' THEN 'Saturday' END WHERE updatedAt = '2025-06-04 05:14:53.571 +00:00';\""

# EXAMPLE from your current data:
# You have two "The Devils" sessions on 2025-06-04 (gap on 2025-06-03)
# Pick the session with timeListening=2482, updatedAt='2025-06-04 05:14:53.571 +00:00'
# Copy that timestamp and replace it in the WHERE clause above

## References

- [Audiobookshelf Site](https://www.audiobookshelf.org/)
- [GitHub](https://github.com/advplyr/audiobookshelf)
- [Tone](https://github.com/sandreas/tone)
