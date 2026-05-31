# Days in a Row — Listening Streak

The "Days in a Row" number is calculated client-side in [`DailyListeningChart.vue`](https://github.com/advplyr/audiobookshelf/blob/v2.34.0/client/components/stats/DailyListeningChart.vue#L186-L208), but we can reproduce and fix it with SQL queries.

## Setup: Entering the SQLite shell

To run the queries below, you first need to open an interactive SQLite shell with formatting enabled (`-header -column`).

### Option 1: In the prod container (UTC)

```bash
# Install sqlite if missing
docker compose exec audiobookshelf ash -c "apk add sqlite"

# Open interactive shell
docker compose exec -it audiobookshelf sqlite3 -header -column /config/absdatabase.sqlite
```

### Option 2: On a local Mac snapshot (Local time)

```bash
# Open interactive shell
sqlite3 -header -column absdatabase.sqlite
```

> **Timezone Warning**: The client algorithm uses browser local time for "today"/"yesterday".
>
> - In the prod container (UTC), `date('now')` works fine.
> - On a local Mac (e.g. EDT), you **must** change `date('now')` to `date('now', 'localtime')` in the queries below.

---

## 1. List sessions (last 20 days)

Run this to see recent sessions and identify gaps.

```sql
SELECT date, dayOfWeek, id, displayTitle,
  round(timeListening/60.0, 1) as mins,
  datetime(createdAt) as created, datetime(updatedAt) as updated
FROM playbackSessions
WHERE date >= date('now', '-20 days')
ORDER BY date DESC, createdAt DESC;
```

## 2. Calculate "days in a row"

Exact reproduction of the client-side algorithm. Walks backward from yesterday; if a day has no listening the streak breaks; adds 1 if today has listening.

```sql
WITH days_map AS (
  SELECT date, SUM(timeListening) as secs
  FROM playbackSessions WHERE timeListening > 0 GROUP BY date
),
today_val AS (
  SELECT COALESCE((SELECT secs FROM days_map WHERE date = date('now')), 0) as today_secs
),
walk AS (
  SELECT 0 as count,
    COALESCE((SELECT secs FROM days_map WHERE date = date('now', '-1 days')), 0) as day_secs
  UNION ALL
  SELECT w.count + 1,
    COALESCE((SELECT secs FROM days_map WHERE date = date('now', '-' || (w.count + 2) || ' days')), 0)
  FROM walk w WHERE w.day_secs > 0 AND w.count < 9999
)
SELECT CASE
  WHEN (SELECT day_secs FROM walk WHERE count = 0) = 0 THEN (SELECT CASE WHEN today_secs > 0 THEN 1 ELSE 0 END FROM today_val)
  ELSE (SELECT max(count) + 1 + (SELECT CASE WHEN today_secs > 0 THEN 1 ELSE 0 END FROM today_val) FROM walk WHERE day_secs > 0)
END as days_in_a_row;
```

## 3. Fix a gap

Move a session to a gap day. Only `date` and `dayOfWeek` matter for the streak calculation.

```sql
UPDATE playbackSessions
SET date = 'YYYY-MM-DD', dayOfWeek = 'Saturday'
WHERE id = 'session-uuid-here';
```

### Example: 2026-05-31

Two gap days (May 23, May 30) broke a 916-day streak to 1.

```sql
-- Move session from May 31 (2 sessions) to fill May 30 gap
UPDATE playbackSessions SET date = '2026-05-30', dayOfWeek = 'Saturday'
WHERE id = '919f3797-ac71-4162-849b-a277d3757998';

-- Move session from May 24 (4 sessions) to fill May 23 gap
UPDATE playbackSessions SET date = '2026-05-23', dayOfWeek = 'Saturday'
WHERE id = '13ed6f87-e4d9-4577-a662-db02fa11559d';

-- Result: 1 → 8 → 916
```
