#!/usr/bin/env bash
# fix_attrs.sh <directory>
#
# Removes com.apple.provenance from all files and subdirectories
# in <directory> using the Docker cp/mv technique.
#
# Workflow:
#   1. Count tainted entries (before)
#   2. Fix files   — cp -p + mv inside Docker (preserves mtime)
#   3. Fix subdirs — mv→mkdir→restore→mv-back, deepest-first
#   4. Count tainted entries (after)
#   5. Report on the root dir itself (Docker mount limitation)
#
# Temp markers (removed on success, findable if interrupted):
#   *.prov_fix.tmp          — files
#   *.prov_fix_dir.tmp      — dirs
#   .prov_fix_filelist      — list file (hidden, deleted on EXIT)
#   .prov_fix_dirlist       — list file (hidden, deleted on EXIT)
#
# Recovery after interruption:
#   find <dir> -name "*.prov_fix.tmp" -type f -delete
#   find <dir> -name "*.prov_fix_dir.tmp" -type d -empty -delete

set -uo pipefail

TARGET="${1:?Usage: fix_attrs.sh <directory>}"
TARGET="$(cd "$TARGET" && pwd)"   # absolute, canonical

FILELIST="${TARGET}/.prov_fix_filelist"
DIRLIST="${TARGET}/.prov_fix_dirlist"
FILESCRIPT="${TARGET}/.prov_fix_files.sh"
DIRSCRIPT="${TARGET}/.prov_fix_dirs.sh"
trap 'rm -f "${FILELIST}" "${DIRLIST}" "${FILESCRIPT}" "${DIRSCRIPT}" 2>/dev/null' EXIT

# ── Preflight ──────────────────────────────────────────────────────────────────
if ! docker info &>/dev/null; then
    echo "✗ Docker is not running."
    exit 1
fi

echo ""
echo "## fix_attrs.sh"
echo ""
echo "Target: ${TARGET}"

# ── Check for leftover temp markers ───────────────────────────────────────────
leftover_files=$(find "${TARGET}" -name "*.prov_fix.tmp"     -type f 2>/dev/null)
leftover_dirs=$( find "${TARGET}" -name "*.prov_fix_dir.tmp" -type d 2>/dev/null)
if [[ -n "${leftover_files}" || -n "${leftover_dirs}" ]]; then
    echo ""
    echo "⚠ Leftover temp markers from a previous interrupted run:"
    [[ -n "${leftover_files}" ]] && echo "${leftover_files}"
    [[ -n "${leftover_dirs}" ]]  && echo "${leftover_dirs}"
    echo ""
    echo "Clean them up first:"
    echo "  find \"${TARGET}\" -name '*.prov_fix.tmp' -type f -delete"
    echo "  find \"${TARGET}\" -name '*.prov_fix_dir.tmp' -type d -empty -delete"
    exit 1
fi

# ── Before counts ─────────────────────────────────────────────────────────────
echo ""
echo "### Before"
before_files=$(find "${TARGET}" -type f -xattrname "com.apple.provenance" 2>/dev/null | wc -l | tr -d ' ')
before_dirs=$( find "${TARGET}" -mindepth 1 -type d -xattrname "com.apple.provenance" 2>/dev/null | wc -l | tr -d ' ')
root_tainted=$(xattr -l "${TARGET}" 2>/dev/null | grep -c "com.apple.provenance" || true)
echo "  Files (tainted)  : ${before_files}"
echo "  Subdirs (tainted): ${before_dirs}"
echo "  Root dir tainted : $([[ ${root_tainted} -gt 0 ]] && echo yes || echo no)"

if [[ "${before_files}" -eq 0 && "${before_dirs}" -eq 0 ]]; then
    echo ""
    echo "✔ Nothing to fix."
    exit 0
fi

# ── Phase 1: Fix files ─────────────────────────────────────────────────────────
echo ""
echo "### Phase 1 — fixing ${before_files} files"

find "${TARGET}" -type f -xattrname "com.apple.provenance" > "${FILELIST}"

cat > "${FILESCRIPT}" << 'SCRIPT'
#!/bin/bash
success=0; fail=0
while IFS= read -r macpath; do
    f="/work${macpath#$HOST_PREFIX}"
    if cp -p "$f" "$f.prov_fix.tmp" && mv "$f.prov_fix.tmp" "$f"; then
        success=$((success+1))
    else
        echo "  FAILED: ${macpath##*/}"
        rm -f "$f.prov_fix.tmp"
        fail=$((fail+1))
    fi
done < /work/.prov_fix_filelist
echo "  fixed: ${success}  failed: ${fail}"
SCRIPT

docker run --rm \
    -e "HOST_PREFIX=${TARGET}" \
    -v "${TARGET}:/work" \
    ubuntu:22.04 bash /work/.prov_fix_files.sh

rm -f "${FILELIST}" "${FILESCRIPT}"

after_files=$(find "${TARGET}" -type f -xattrname "com.apple.provenance" 2>/dev/null | wc -l | tr -d ' ')
echo "  Remaining tainted files: ${after_files}"
[[ "${after_files}" -eq 0 ]] && echo "  ✔ All files clean." || echo "  ✗ Some files still tainted."

# ── Phase 2: Fix subdirs (deepest-first, excluding root) ──────────────────────
echo ""
echo "### Phase 2 — fixing ${before_dirs} subdirectories (deepest-first)"

# Exclude the mount root — cannot mv Docker mount point
find "${TARGET}" -mindepth 1 -type d -xattrname "com.apple.provenance" | \
    awk '{ n=gsub("/","/"); print n "\t" $0 }' | sort -rn | cut -f2- > "${DIRLIST}"

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
                success=$((success+1))
            else
                echo "  WARNING (tmp not empty): $tmp"
                fail=$((fail+1))
            fi
        else
            mv "$tmp" "$d"
            echo "  FAILED mkdir: ${macpath##*/}/"
            fail=$((fail+1))
        fi
    else
        echo "  FAILED mv: ${macpath##*/}/"
        fail=$((fail+1))
    fi
done < /work/.prov_fix_dirlist
echo "  fixed: ${success}  failed: ${fail}"
SCRIPT

docker run --rm \
    -e "HOST_PREFIX=${TARGET}" \
    -v "${TARGET}:/work" \
    ubuntu:22.04 bash /work/.prov_fix_dirs.sh

rm -f "${DIRLIST}" "${DIRSCRIPT}"

after_dirs=$(find "${TARGET}" -mindepth 1 -type d -xattrname "com.apple.provenance" 2>/dev/null | wc -l | tr -d ' ')
echo "  Remaining tainted subdirs: ${after_dirs}"
[[ "${after_dirs}" -eq 0 ]] && echo "  ✔ All subdirs clean." || echo "  ✗ Some subdirs still tainted."

# ── After summary ─────────────────────────────────────────────────────────────
echo ""
echo "### After"
echo "  Files (tainted)  : ${after_files}"
echo "  Subdirs (tainted): ${after_dirs}"

root_tainted=$(xattr -l "${TARGET}" 2>/dev/null | grep -c "com.apple.provenance" || true)
echo "  Root dir tainted : $([[ ${root_tainted} -gt 0 ]] && echo yes || echo no)"

if [[ "${root_tainted}" -gt 0 ]]; then
    echo ""
    echo "⚠ The root directory itself (${TARGET##*/}/) still has the xattr."
    echo "  Docker cannot rename its own mount point."
    echo "  Fix it by mounting the parent:"
    PARENT="${TARGET%/*}"
    BASENAME="${TARGET##*/}"
    echo ""
    echo "  docker run --rm -e D=\"${BASENAME}\" -v \"${PARENT}:/work\" ubuntu:22.04 bash -c \\"
    echo "    'perms=\$(stat -c \"%a\" \"/work/\$D\"); mtime=\$(stat -c \"%Y\" \"/work/\$D\"); \\"
    echo "     mv \"/work/\$D\" \"/work/\$D.prov_fix_dir.tmp\" && \\"
    echo "     mkdir \"/work/\$D\" && chmod \"\$perms\" \"/work/\$D\" && \\"
    echo "     find \"/work/\$D.prov_fix_dir.tmp\" -maxdepth 1 -mindepth 1 -print0 | xargs -0 -I\"{\" mv \"{\" \"/work/\$D/\" && \\"
    echo "     touch -d \"@\$mtime\" \"/work/\$D\" && \\"
    echo "     rmdir \"/work/\$D.prov_fix_dir.tmp\"'"
fi

echo ""
