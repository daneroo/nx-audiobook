#!/usr/bin/env bash
# xattr-fix-demo.sh
#
# Proof-of-concept: removes com.apple.provenance from a fresh test fixture.
# Proves the Docker technique works before applying it to real data.
#
# Usage: ./xattr-fix-demo.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEST_DIR="${SCRIPT_DIR}/data/test-fixture"

# All temp files live inside TEST_DIR (which is mounted in Docker)
FILELIST="${TEST_DIR}/.prov_fix_filelist"
DIRLIST="${TEST_DIR}/.prov_fix_dirlist"
FILESCRIPT="${TEST_DIR}/.prov_fix_files.sh"
DIRSCRIPT="${TEST_DIR}/.prov_fix_dirs.sh"
trap 'rm -f "${FILELIST}" "${DIRLIST}" "${FILESCRIPT}" "${DIRSCRIPT}" 2>/dev/null' EXIT

# ── State table ────────────────────────────────────────────────────────────────
show_state() {
    local label="$1"
    echo ""
    echo "### ${label}"
    printf "| %-38s | %-16s | %-5s | %-30s |\n" "path" "mtime" "perms" "xattrs"
    printf "| %-38s | %-16s | %-5s | %-30s |\n" \
        "--------------------------------------" "----------------" "-----" "------------------------------"
    while IFS= read -r -d '' entry; do
        [[ "$entry" == *".prov_fix"* ]] && continue
        rel="${entry#${TEST_DIR}/}"
        [ "$rel" = "$entry" ] && rel="$(basename "$entry")/"   # root itself
        mtime=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$entry" 2>/dev/null || echo "?")
        perms=$(stat -f "%Lp" "$entry"              2>/dev/null || echo "?")
        raw=$(xattr "$entry" 2>/dev/null | tr '\n' ' ')
        xattrs="${raw:-(none)}"
        [ -d "$entry" ] && rel="${rel%/}/"
        printf "| %-38s | %-16s | %-5s | %-30s |\n" "$rel" "$mtime" "$perms" "$xattrs"
    done < <(find "$TEST_DIR" -print0 | sort -z)
    echo ""
}

# ── Preflight ──────────────────────────────────────────────────────────────────
echo "# xattr-fix-demo"
echo ""
if ! docker info &>/dev/null; then
    echo "✗ Docker is not running."
    exit 1
fi
echo "✔ Docker is running."

# ── Setup ─────────────────────────────────────────────────────────────────────
echo ""
echo "## Setup — fresh test fixture"
rm -rf "${TEST_DIR}"
mkdir -p "${TEST_DIR}/series/deeper"
printf 'fake epub content' > "${TEST_DIR}/book1.epub"
printf 'fake mp3 part 1'  > "${TEST_DIR}/series/part1.txt"
printf 'fake mp3 part 2'  > "${TEST_DIR}/series/part2.txt"
printf 'fake pdf content' > "${TEST_DIR}/series/deeper/extra.txt"

REF_MTIME=$(stat -f "%m" "${TEST_DIR}/book1.epub")
show_state "BEFORE — all tainted by macOS"

file_count=$(find "${TEST_DIR}" -type f -xattrname "com.apple.provenance" 2>/dev/null | wc -l | tr -d ' ')
dir_count=$( find "${TEST_DIR}" -type d -xattrname "com.apple.provenance" 2>/dev/null | wc -l | tr -d ' ')
echo "✗ ${file_count} files and ${dir_count} directories tainted"

# ── Phase 1: Fix files ─────────────────────────────────────────────────────────
echo ""
echo "## Phase 1 — files (cp -p + mv)"

find "${TEST_DIR}" -type f -xattrname "com.apple.provenance" > "${FILELIST}"

cat > "${FILESCRIPT}" << 'SCRIPT'
#!/bin/bash
success=0; fail=0
while IFS= read -r macpath; do
    f="/work${macpath#$HOST_PREFIX}"
    if cp -p "$f" "$f.prov_fix.tmp" && mv "$f.prov_fix.tmp" "$f"; then
        echo "  ✔ ${macpath##*/}"
        success=$((success+1))
    else
        echo "  ✗ FAILED: ${macpath##*/}"
        rm -f "$f.prov_fix.tmp"
        fail=$((fail+1))
    fi
done < /work/.prov_fix_filelist
echo "  files fixed: ${success}  failed: ${fail}"
SCRIPT

docker run --rm \
    -e "HOST_PREFIX=${TEST_DIR}" \
    -v "${TEST_DIR}:/work" \
    ubuntu:22.04 bash /work/.prov_fix_files.sh

rm -f "${FILELIST}" "${FILESCRIPT}"
show_state "AFTER Phase 1 — files should be clean"

# ── Phase 2: Fix subdirs (deepest-first) ──────────────────────────────────────
echo ""
echo "## Phase 2 — subdirs (mv + mkdir + restore, deepest-first)"
echo "   (mount root test-fixture/ excluded — can't mv Docker mount point)"
echo ""

find "${TEST_DIR}" -mindepth 1 -type d -xattrname "com.apple.provenance" | \
    awk '{ n=gsub("/","/"); print n "\t" $0 }' | sort -rn | cut -f2- > "${DIRLIST}"

echo "Processing order:"
while IFS= read -r d; do echo "  ${d#${TEST_DIR}/}/"; done < "${DIRLIST}"
echo ""

cat > "${DIRSCRIPT}" << 'SCRIPT'
#!/bin/bash
success=0; fail=0
while IFS= read -r macpath; do
    d="/work${macpath#$HOST_PREFIX}"
    [ -d "$d" ] || { echo "  SKIP (gone): ${macpath##*/}/"; continue; }
    tmp="${d}.prov_fix_dir.tmp"
    perms=$(stat -c '%a' "$d" 2>/dev/null) || { echo "  SKIP (stat): ${macpath##*/}/"; continue; }
    mtime=$(stat -c '%Y' "$d" 2>/dev/null)
    if mv "$d" "$tmp"; then
        if mkdir "$d"; then
            chmod "$perms" "$d"
            find "$tmp" -maxdepth 1 -mindepth 1 -print0 | xargs -0 -I'{}' mv '{}' "$d/" 2>/dev/null || true
            touch -d "@$mtime" "$d"
            if rmdir "$tmp" 2>/dev/null; then
                echo "  ✔ ${macpath##*/}/"
                success=$((success+1))
            else
                echo "  ⚠ tmp not empty: $tmp"
                fail=$((fail+1))
            fi
        else
            mv "$tmp" "$d"
            echo "  ✗ FAILED mkdir: ${macpath##*/}/"
            fail=$((fail+1))
        fi
    else
        echo "  ✗ FAILED mv: ${macpath##*/}/"
        fail=$((fail+1))
    fi
done < /work/.prov_fix_dirlist
echo "  dirs fixed: ${success}  failed: ${fail}"
SCRIPT

docker run --rm \
    -e "HOST_PREFIX=${TEST_DIR}" \
    -v "${TEST_DIR}:/work" \
    ubuntu:22.04 bash /work/.prov_fix_dirs.sh

rm -f "${DIRLIST}" "${DIRSCRIPT}"
show_state "AFTER Phase 2 — all entries should be clean"

# ── Verify ─────────────────────────────────────────────────────────────────────
echo "## Verify"
remaining_files=$(find "${TEST_DIR}" -type f    -xattrname "com.apple.provenance" 2>/dev/null | wc -l | tr -d ' ')
remaining_dirs=$(find  "${TEST_DIR}" -mindepth 1 -type d -xattrname "com.apple.provenance" 2>/dev/null | wc -l | tr -d ' ')
root_tainted=$(xattr -l "${TEST_DIR}" 2>/dev/null | grep -c "com.apple.provenance" || true)

[[ "${remaining_files}" -eq 0 ]] && echo "✔ Files: all clean" || echo "✗ Files: ${remaining_files} still tainted"
[[ "${remaining_dirs}" -eq 0 ]]  && echo "✔ Subdirs: all clean" || echo "✗ Subdirs: ${remaining_dirs} still tainted"
[[ "${root_tainted}" -gt 0 ]]    && echo "⚠ Root dir still tainted (expected — mount point limitation)" || echo "✔ Root dir: clean"

# ── Idempotency ────────────────────────────────────────────────────────────────
echo ""
echo "## Idempotency — recount on clean tree"
recheck=$(find "${TEST_DIR}" -type f -xattrname "com.apple.provenance" 2>/dev/null | wc -l | tr -d ' ')
[[ "${recheck}" -eq 0 ]] && echo "✔ 0 tainted files — correct no-op" || echo "✗ ${recheck} still tainted"

after_mtime=$(stat -f "%m" "${TEST_DIR}/book1.epub")
[[ "${REF_MTIME}" == "${after_mtime}" ]] && echo "✔ mtime preserved" || echo "✗ mtime changed"

echo ""
echo "---"
echo "Demo complete."
