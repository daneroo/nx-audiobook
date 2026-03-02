# /// script
# requires-python = ">=3.11"
# ///
"""
show_xattr.py — decode com.apple.provenance across a directory tree.

Usage:
    uv run show_xattr.py <directory> [<directory> ...]

Examples:
    uv run show_xattr.py /Volumes/Space/Staging
    uv run show_xattr.py /Volumes/Space/Reading/audiobooks
    uv run show_xattr.py /Volumes/Space/Staging /Volumes/Space/Reading/audiobooks
    uv run show_xattr.py "/Volumes/Space/Reading/audiobooks/Cal NewPort - So Good They Cant Ignore You/"

What it shows:
    - Every unique token found (decoded: version, origin, 8-byte DB key)
    - How many files/dirs carry each token, with examples
    - Entries with NO xattr (pre-2022 pristine files, or Docker-fixed files)
    - Which token matches the current login session (labelled, not emphasised)

Token format (11 bytes):
    01  02  00  9D 30 D4 44 3F F4 E9 D5
    |   |   |   |_________________________|
    |   |   flags                         8-byte primary key
    |   origin: 01=kernel 02=local-user 03=download
    version (always 1)

    The 8-byte key points to a row in:
    /var/db/SystemPolicyConfiguration/ExecPolicy  (root-only SQLite)
    All files written in the same login session share an identical key.
    Different keys = different sessions = different taint events.
"""

import os
import sys
import struct
import subprocess
import tempfile
from collections import defaultdict
from dataclasses import dataclass, field

ORIGIN = {0x00: "system", 0x01: "kernel/launchd", 0x02: "local-user", 0x03: "download"}


@dataclass
class Token:
    raw: bytes
    files: list = field(default_factory=list)
    dirs:  list = field(default_factory=list)

    @property
    def version(self):     return self.raw[0]
    @property
    def origin_byte(self): return self.raw[1]
    @property
    def origin(self):      return ORIGIN.get(self.raw[1], f"0x{self.raw[1]:02x}")
    @property
    def key_hex(self):     return self.raw[3:].hex()
    @property
    def hex(self):         return self.raw.hex()
    @property
    def count(self):       return len(self.files) + len(self.dirs)

    def fmt(self):
        return " ".join(f"{b:02X}" for b in self.raw)


def get_prov(path: str) -> bytes | None:
    r = subprocess.run(["xattr", "-px", "com.apple.provenance", path],
                       capture_output=True, text=True)
    if r.returncode != 0:
        return None
    try:
        return bytes.fromhex(r.stdout.strip().replace(" ", "").replace("\n", ""))
    except ValueError:
        return None


def current_session_token() -> bytes | None:
    try:
        with tempfile.NamedTemporaryFile(delete=False) as f:
            path = f.name
        tok = get_prov(path)
        os.unlink(path)
        return tok
    except Exception:
        return None


def scan(root: str) -> tuple[dict[str, Token], list[str]]:
    tokens: dict[str, Token] = {}
    clean: list[str] = []

    for dirpath, dirnames, filenames in os.walk(root):
        raw = get_prov(dirpath)
        if raw is None:
            clean.append(dirpath)
        else:
            if raw.hex() not in tokens:
                tokens[raw.hex()] = Token(raw)
            tokens[raw.hex()].dirs.append(dirpath)

        for fname in filenames:
            fpath = os.path.join(dirpath, fname)
            raw = get_prov(fpath)
            if raw is None:
                clean.append(fpath)
            else:
                if raw.hex() not in tokens:
                    tokens[raw.hex()] = Token(raw)
                tokens[raw.hex()].files.append(fpath)

    return tokens, clean


def report(roots: list[str]) -> None:
    session = current_session_token()

    all_tokens: dict[str, Token] = {}
    all_clean:  list[str] = []

    W = 70
    print(f"\n{'='*W}")
    print("  com.apple.provenance — tree report")
    print(f"{'='*W}")

    for root in roots:
        print(f"\n  Scanning: {root}")
        if not os.path.exists(root):
            print("  ✗ path not found"); continue
        tokens, clean = scan(root)
        tainted = sum(t.count for t in tokens.values())
        print(f"  Tainted : {tainted}   Clean (no xattr): {len(clean)}")
        for k, tok in tokens.items():
            if k not in all_tokens:
                all_tokens[k] = Token(tok.raw)
            all_tokens[k].files.extend(tok.files)
            all_tokens[k].dirs.extend(tok.dirs)
        all_clean.extend(clean)

    # ── Tokens ────────────────────────────────────────────────────────────────
    print(f"\n{'─'*W}")
    print(f"  TAINTED — {len(all_tokens)} unique token(s)")
    print(f"{'─'*W}")

    for tok in sorted(all_tokens.values(), key=lambda t: -t.count):
        is_now = session and tok.raw == session
        tag = "  ← this login session" if is_now else "  ← historical session"
        print(f"\n  {tok.fmt()}{tag}")
        print(f"  origin : {tok.origin} (0x{tok.origin_byte:02x})")
        print(f"  DB key : {tok.key_hex}  →  ExecPolicy provenance_tracking")
        print(f"  count  : {len(tok.files)} files + {len(tok.dirs)} dirs = {tok.count}")
        examples = (tok.files + tok.dirs)[:4]
        for ex in examples:
            print(f"           {ex}")
        if tok.count > 4:
            print(f"           … {tok.count - 4} more")

    # ── Clean ─────────────────────────────────────────────────────────────────
    print(f"\n{'─'*W}")
    print(f"  CLEAN — {len(all_clean)} entries (no com.apple.provenance)")
    if all_clean:
        print("  Pre-2022 archive files, or entries fixed by Docker.")
        for p in all_clean[:6]:
            print(f"    {p}")
        if len(all_clean) > 6:
            print(f"    … {len(all_clean) - 6} more")
    else:
        print("  None — everything in this tree is tainted.")

    # ── Root dir ──────────────────────────────────────────────────────────────
    for root in roots:
        root_raw = get_prov(root)
        if root_raw:
            print(f"\n{'─'*W}")
            print(f"  ROOT DIR: {root}")
            print(f"  Still tainted: {root_raw.hex()}")
            print(f"  Docker cannot fix its own mount point.")
            print(f"  Fix by mounting the parent — see fix_attrs.sh output for the command.")

    print()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    report(sys.argv[1:])
