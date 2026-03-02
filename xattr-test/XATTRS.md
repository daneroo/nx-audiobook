# `com.apple.provenance` — Problem, Analysis, and Fix

## Directory layout

```bash
xattr-test/
  XATTRS.md            ← this file
  xattr-fix-demo.sh    ← standalone proof-of-concept (run this first)
  .gitignore           ← ignores data/
  data/                ← gitignored; all artifacts live here
    test-fixture/      ← created and destroyed by xattr-fix-demo.sh
    fix-test/          ← leftover from earlier manual experiments
    test-fix/          ← leftover from earlier manual experiments
    with-xattr-file/   ← source epub used in original manual tests
```

Run the demo:

```bash
cd xattr-test
./xattr-fix-demo.sh
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
  - The `provenance_tracking` table in `/var/db/SystemPolicyConfiguration/ExecPolicy`
    was introduced alongside it — the xattr is just a pointer into that DB

- macOS 14 Sonoma (September 2023) — widened to all app bundles

  - No longer limited to quarantined downloads
  - Any `.app` bundle — including ones you built yourself locally — gets tagged
  - The value became unremovable even on non-system volumes (`xattr -d` silently fails)
  - Security researchers noted the xattr persists through App Store installs too

- macOS 15 Sequoia (September 2024) — widened further

  - Applied to a broader set of file operations beyond app bundles
  - Users reported it appearing on files synced by rsync, copied by Finder,
    and written by developer tools
  - The `xattr -c` silent-failure behaviour became consistently reproducible
    across all volume types, confirming protection is kernel-level not SIP-based

- macOS 26 Tahoe (2025–, confirmed 2026-03-01 on 26.1)
  - **Applied to everything.** Every `touch`, `mkdir`, `open()` from any user
    process in any context — terminal, Python, AppleScript — gets tagged instantly
  - Confirmed live: same session token on files created by completely unrelated
    processes (Terminal.app, Python, osascript, Claude Code subprocess)
- Files from before ~2022 on archival volumes are untouched (xattr applied at
  write time, never retroactively)
- The value is a **per-login-session token** — identical for all files written
  in one session, changes on next login
- `xattr -d` and `xattr -c` fail silently on all volume types

**The pattern:** Apple started with "track where downloaded apps came from"
and has generalised it to "track who created every file on the system."
The DB stays root-only, so the xattr itself is an opaque pointer — but it
enables full audit correlation for anyone with root access.

### Cannot be removed by standard tools

```bash
xattr -d com.apple.provenance file   # silently fails — no error, still there
xattr -c file                        # also silently fails
```

This is a **kernel-level hook**, not SIP. It fails even on non-system volumes
(`/Volumes/Space`). Disabling SIP would likely not help — the protection is
in the VFS layer, not in SIP's file-system restrictions.

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
`/var/db/SystemPolicyConfiguration/ExecPolicy` (SQLite, root-only). The xattr
is just a pointer; the actual audit metadata lives in that DB.

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

## Solution: Docker VirtioFS + cp/mv

Docker container operations run under the **Linux kernel**, which has no macOS
VFS hooks. Files and directories created inside the container get a new inode
that was never registered with macOS's provenance system. The fix is permanent.

### Fix a single file

```bash
docker run --rm -v ./path:/work ubuntu:22.04 bash -c \
  'cp -p /work/file.ext /work/file.ext.tmp && mv /work/file.ext.tmp /work/file.ext'
```

- `cp -p` preserves `mtime`, permissions, ownership
- `mv` is atomic on the same filesystem

### Fix files in bulk (one container invocation)

Pre-generate the list on macOS (where `-xattrname` is available), write it
as a hidden file inside the mounted volume, then read it from within Docker:

```bash
TARGET="/Volumes/Space/Staging"

find "${TARGET}" -type f -xattrname "com.apple.provenance" \
    > "${TARGET}/.prov_fix_filelist"

docker run --rm \
    -e "HOST_PREFIX=${TARGET}" \
    -v "${TARGET}:/work" \
    ubuntu:22.04 bash << 'DOCKER_FILES'
while IFS= read -r macpath; do
    f="/work${macpath#$HOST_PREFIX}"
    cp -p "$f" "$f.prov_fix.tmp" && mv "$f.prov_fix.tmp" "$f"
done < /work/.prov_fix_filelist
DOCKER_FILES

rm -f "${TARGET}/.prov_fix_filelist"
```

### Fix directories (deepest-first)

Directories require a different technique — `cp` cannot replace a directory
atomically. Instead, for each directory inside Docker:

1. `mv dir dir.prov_fix_dir.tmp` — rename (preserves contents, old inode)
2. `mkdir dir` — new Linux inode, no macOS provenance hook
3. Restore permissions and mtime from the `.tmp` copy
4. Move all contents from `.tmp` back into `dir`
5. `rmdir .tmp` — now empty

**Must process deepest-first** (sort by slash count descending) so children
are always replaced before their parent.

**Limitation:** the directory mounted as `/work` (the mount root) cannot be
renamed. Fix the mount root by mounting its _parent_ and operating from there.

### Temp markers

| Type | Pattern              | Find leftovers                                  |
| ---- | -------------------- | ----------------------------------------------- |
| File | `*.prov_fix.tmp`     | `find <dir> -name "*.prov_fix.tmp" -type f`     |
| Dir  | `*.prov_fix_dir.tmp` | `find <dir> -name "*.prov_fix_dir.tmp" -type d` |

Cleanup after an interrupted run:

```bash
find <dir> -name "*.prov_fix.tmp"     -type f -delete
find <dir> -name "*.prov_fix_dir.tmp" -type d -empty -delete
```

---

## Justfile integration

`just fix-provenance` and `just fix-provenance-in-dir <dir>` — planned addition
to the root `Justfile` after `xattr-fix-demo.sh` has been validated on the
target directory.

---

## References

- [Eclectic Light: How macOS now tracks the provenance of apps](https://eclecticlight.co/2023/05/10/how-macos-now-tracks-the-provenance-of-apps/)
- [Eclectic Light: What is macOS Ventura doing tracking provenance?](https://eclecticlight.co/2023/03/16/what-is-macos-ventura-doing-tracking-provenance/)
- [Michael Tsai: Ventura Adds com.apple.provenance](https://mjtsai.com/blog/2023/03/16/ventura-adds-com-apple-provenance/)
- [Apple Developer Forums: What is com.apple.provenance?](https://developer.apple.com/forums/thread/723397)
