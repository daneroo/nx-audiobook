# `com.apple.provenance` — Problem, Analysis, and Fix

## Directory layout

```bash
xattr-test/
  XATTRS.md      ← this file
  xattr.ts       ← library: getAttr, toHex, scan, sessionToken, fixFile, fixDir, fixTree
  cli.ts         ← CLI entry point: show / fix / dryrun
  xattr_test.ts  ← integration tests
  deno.json      ← Deno project root + task definitions
  data/          ← gitignored; created and torn down by the test suite
```

## Usage

```bash
cd xattr-test

# Run integration tests
deno task test

# Show scan result for a directory
deno task show xattr-test/data

# Show what would be fixed (no changes made)
deno task dryrun /Volumes/Space/Staging/Author

# Fix all tainted entries
deno task fix /Volumes/Space/Staging/Author
```

### CLI output

**show**:

```bash
── show  /Volumes/Space/Staging/Author
   216 total · 160 tainted · 56 clean · 2 session tokens

   01 02 00 9d 30 d4 44 3f f4 e9 d5   ← this session
   local-user · 142 files · 18 dirs

   01 02 00 ab cd ef 12 34 56 78 90
   local-user · 23 files · 4 dirs

   56 clean  (no xattr — pre-2022 or already fixed)
```

**dryrun**:

```bash
── dryrun  /Volumes/Space/Staging/Author
   216 total · 160 tainted · 56 clean · 2 session tokens

   would fix  165 files
   would fix   22 dirs
   skip        56 clean entries
```

**fix**:

```bash
── fix  /Volumes/Space/Staging/Author
   216 total · 160 tainted · 56 clean · 2 session tokens

   fixing 165 files... ✓
   fixing  22 dirs...  ✓

   187 entries cleaned
```

---

## The problem

macOS tags **every file and directory you create** with `com.apple.provenance`.

```bash
touch /tmp/test.txt
xattr -l /tmp/test.txt
# → com.apple.provenance:
```

This is **not** a background process. It fires at the kernel VFS layer on every
`open()`, `mkdir()`, etc. — before user space gets control.

### History of scope creep

Apple has progressively expanded what triggers this xattr across every release.

- macOS 13 Ventura (October 2022) — introduced

  - Applied only to apps that cleared Gatekeeper / quarantine
  - Designed to supplement `com.apple.quarantine` with a persistent audit trail
  - An app downloaded from the web would get both `com.apple.quarantine`
    (removed on first launch approval) and `com.apple.provenance` (permanent)
  - `xattr -d` on a non-system volume _appeared_ to work in early Ventura builds
  - The `provenance_tracking` table in
    `/var/db/SystemPolicyConfiguration/ExecPolicy` was introduced alongside it —
    the xattr is just a pointer into that DB

- macOS 14 Sonoma (September 2023) — widened to all app bundles

  - No longer limited to quarantined downloads
  - Any `.app` bundle — including ones you built yourself locally — gets tagged
  - The value became unremovable even on non-system volumes (`xattr -d` silently
    fails)
  - Security researchers noted the xattr persists through App Store installs too

- macOS 15 Sequoia (September 2024) — widened further

  - Applied to a broader set of file operations beyond app bundles
  - Users reported it appearing on files synced by rsync, copied by Finder, and
    written by developer tools
  - The `xattr -c` silent-failure behaviour became consistently reproducible
    across all volume types, confirming protection is kernel-level not SIP-based

- macOS 26 Tahoe (2025–, confirmed 2026-03-01 on 26.1)

  - **Applied to everything.** Every `touch`, `mkdir`, `open()` from any user
    process in any context — terminal, Python, AppleScript — gets tagged
    instantly
  - Confirmed live: same session token on files created by completely unrelated
    processes (Terminal.app, Python, osascript, Claude Code subprocess)

- Files from before ~2022 on archival volumes are untouched (xattr applied at
  write time, never retroactively)
- The value is a **per-login-session token** — identical for all files written
  in one session, changes on next login
- `xattr -d` and `xattr -c` fail silently on all volume types

**The pattern:** Apple started with "track where downloaded apps came from" and
has generalised it to "track who created every file on the system." The DB stays
root-only, so the xattr itself is an opaque pointer — but it enables full audit
correlation for anyone with root access.

### Cannot be removed by standard tools

```bash
xattr -d com.apple.provenance file   # silently fails — no error, still there
xattr -c file                        # also silently fails
```

This is a **kernel-level hook**, not SIP. It fails even on non-system volumes
(`/Volumes/Space`). Disabling SIP would likely not help — the protection is in
the VFS layer, not in SIP's file-system restrictions.

---

## Binary format

```
01  02  00  9D 30 D4 44 3F F4 E9 D5
─┬─ ─┬─ ─┬─ ─────────┬─────────────
 │   │   │           └── 8-byte primary key → ExecPolicy DB (root-only)
 │   │   └── flags (0x00)
 │   └── origin type
 └── format version (0x01)
```

**Origin type (byte 1):**

| Value  | Meaning                   |
| ------ | ------------------------- |
| `0x01` | kernel / launchd / system |
| `0x02` | local user process        |
| `0x03` | network / downloaded      |

**The 8-byte key** is a primary key into the `provenance_tracking` table in
`/var/db/SystemPolicyConfiguration/ExecPolicy` (SQLite, root-only). The xattr is
just a pointer; the actual audit metadata lives in that DB.

**Key observation:** every process in the same login session — Terminal, Python,
osascript, any shell — produces the **identical** 11-byte value. It is a
per-login-session token, not a per-file or per-app fingerprint.

---

## Diagnostic

```bash
# Count affected entries
find <dir> -xattrname "com.apple.provenance" -type f | wc -l
find <dir> -xattrname "com.apple.provenance" -type d | wc -l

# Show raw bytes
xattr -lvx <file>
```

---

## Solution: Docker + alpine:3.23

Docker container operations run under the **Linux kernel**, which has no macOS
VFS hooks. Files and directories created inside the container get a new inode
that was never registered with macOS's provenance system. The fix is permanent.

### API (`xattr.ts`)

```typescript
import { fixDir, fixFile, fixTree } from "./xattr.ts";

await fixFile("/Volumes/Space/Staging/Author/book.epub");
await fixDir("/Volumes/Space/Staging/Author/Series");
await fixTree("/Volumes/Space/Staging/Author");
```

### `fixFile`

One Docker call per file. Mounts the parent directory.

```
cp -p file file.tmp && mv file.tmp file
```

`cp -p` preserves mtime, permissions, and ownership. `mv` is atomic on the same
filesystem.

### `fixDir`

One Docker call per directory. Mounts the parent directory. Permissions and
mtime are read by Deno on the macOS side before the container runs.

```bash
mv dir dir.tmp
mkdir -m <perms> dir
find dir.tmp -maxdepth 1 -mindepth 1 -print0 | xargs -0r mv -t dir/
touch -d @<epoch> dir
rmdir dir.tmp
```

`find | xargs` instead of `mv dir.tmp/* dir/` — glob misses dotfiles and fails
on empty directories.

### `fixTree`

Walks the tree, collects all tainted entries, then:

1. Fixes all files (any order, one Docker call each)
2. Fixes all directories sorted **deepest-first** (by path depth descending) so
   children are always rebuilt before their parent

### Temp markers

Interrupted runs leave `*.tmp` entries. Clean up with:

```bash
find <dir> -name "*.tmp" -type f -delete
find <dir> -name "*.tmp" -type d -empty -delete
```

---

## References

- [Eclectic Light: How macOS now tracks the provenance of apps](https://eclecticlight.co/2023/05/10/how-macos-now-tracks-the-provenance-of-apps/)
- [Eclectic Light: What is macOS Ventura doing tracking provenance?](https://eclecticlight.co/2023/03/16/what-is-macos-ventura-doing-tracking-provenance/)
- [Michael Tsai: Ventura Adds com.apple.provenance](https://mjtsai.com/blog/2023/03/16/ventura-adds-com-apple-provenance/)
- [Apple Developer Forums: What is com.apple.provenance?](https://developer.apple.com/forums/thread/723397)
