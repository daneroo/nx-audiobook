import { assertEquals, assertNotEquals } from "@std/assert";
import { walk } from "@std/fs/walk";
import { fixDir, fixFile, fixTree, getAttr } from "./xattr.ts";

// Problem
// ───────
// audiobookshelf runs in Docker (Linux). Our audiobook library lives on a macOS
// host volume mounted into the container. macOS 26 Tahoe silently tags EVERY
// file and directory — created by any process, in any location — with the
// extended attribute com.apple.provenance. The tag is injected at the kernel
// VFS layer and cannot be removed by xattr -d or xattr -c (they silently fail).
//
// This causes audiobookshelf to misread or reject files because it encounters
// xattrs it does not expect on a Linux filesystem.
//
// Solution
// ────────
// Route each tainted entry through a Docker container. The Linux kernel has no
// macOS VFS hooks, so a file or directory created inside the container gets a
// fresh inode with no provenance xattr. The fix is permanent — the new inode
// is never registered with macOS's provenance system.
//
//   file:      cp -p (preserves mtime/perms) + mv (atomic replace)
//   directory: mv to .tmp, mkdir fresh, restore perms+mtime, move contents back
//
// These tests prove the fix works at every granularity before we run it on the
// real library at /Volumes/Space/Staging.

const DATA = new URL("data", import.meta.url).pathname;
const d = (name: string) => `${DATA}/${name}`;

function setup(path: string): void {
  try {
    Deno.removeSync(path, { recursive: true });
  } catch { /* ok */ }
  Deno.mkdirSync(path, { recursive: true });
}

// ── 1. Confirm the problem ────────────────────────────────────────────────────
// Before we can fix anything we need to reliably detect it. The xattr value is
// an 11-byte struct:  version(1) | origin(1) | flags(1) | session-key(8)
// For any normal user process: 01 02 00 <8-byte key> — 32 hex chars with spaces.
// Critically: the 8-byte key is IDENTICAL for every file written in the same
// login session. It is a session token, not a per-file fingerprint.
Deno.test("problem confirmed: every new file carries the same session token", async () => {
  const dir = d("getattr");
  setup(dir);
  Deno.writeTextFileSync(`${dir}/a.txt`, "a");
  Deno.writeTextFileSync(`${dir}/b.txt`, "b");

  const a = await getAttr(`${dir}/a.txt`);
  const b = await getAttr(`${dir}/b.txt`);

  assertNotEquals(a, null, "file created on macOS must be tagged");
  assertEquals(a!.length, 11, "provenance struct is 11 bytes");
  assertEquals(a![0], 0x01, "byte 0: format version");
  assertEquals(a![1], 0x02, "byte 1: origin = local user process");
  assertEquals(a![2], 0x00, "byte 2: flags");
  assertEquals(
    a,
    b,
    "both files share the same per-session token — confirms kernel-level tagging",
  );
});

// ── 2. Fix a single file ──────────────────────────────────────────────────────
// Every audiobook asset (.epub, .mp3, .m4b, .jpg) is a file. This proves the
// cp+mv pattern strips the xattr and the file is still accessible afterwards.
Deno.test("fix confirmed: Docker cp+mv produces a clean inode for a file", async () => {
  const dir = d("fixfile");
  setup(dir);
  Deno.writeTextFileSync(`${dir}/book.epub`, "fake epub");
  assertNotEquals(
    await getAttr(`${dir}/book.epub`),
    null,
    "file must be tainted before fix",
  );
  await fixFile(`${dir}/book.epub`);
  assertEquals(
    await getAttr(`${dir}/book.epub`),
    null,
    "file must be clean after fix",
  );
});

// ── 3. Fix a single directory ─────────────────────────────────────────────────
// Author dirs, series dirs, and the library root are all directories. The cp+mv
// trick doesn't work for dirs, so we recreate the inode with mv+mkdir instead.
// Mounting the parent means even the root of a target tree can be fixed.
Deno.test("fix confirmed: Docker mv+mkdir produces a clean inode for a directory", async () => {
  const dir = d("fixdir");
  setup(dir);
  assertNotEquals(
    await getAttr(dir),
    null,
    "directory must be tainted before fix",
  );
  await fixDir(dir);
  assertEquals(await getAttr(dir), null, "directory must be clean after fix");
});

// ── 4. Fix a full library tree ────────────────────────────────────────────────
// In production fixTree will be called on /Volumes/Space/Staging/<author>/ or
// the entire staging root. Files first (any order), then directories deepest-
// first so each dir is rebuilt only after all its children are already clean.
Deno.test("fix confirmed: fixTree cleans every node in an author/series/book tree", async () => {
  const dir = d("fixtree");
  setup(dir);
  Deno.mkdirSync(`${dir}/series/book1`, { recursive: true });
  Deno.writeTextFileSync(`${dir}/author.nfo`, "Author Name");
  Deno.writeTextFileSync(`${dir}/series/series.nfo`, "Series Name");
  Deno.writeTextFileSync(`${dir}/series/book1/book.epub`, "fake epub");

  let sessionToken: Uint8Array | null = null;
  for await (const { path } of walk(dir)) {
    const attr = await getAttr(path);
    assertNotEquals(attr, null, `must be tainted before fix: ${path}`);
    sessionToken ??= attr;
    assertEquals(
      attr,
      sessionToken,
      `all nodes share same session token: ${path}`,
    );
  }

  await fixTree(dir);

  for await (const { path } of walk(dir)) {
    assertEquals(await getAttr(path), null, `must be clean after fix: ${path}`);
  }
});
