#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write

const ATTR = "com.apple.provenance";

function getAttr(path: string): string | null {
  const r = new Deno.Command("xattr", {
    args: ["-px", ATTR, path],
    stderr: "null",
  }).outputSync();
  return r.code === 0
    ? new TextDecoder().decode(r.stdout).trim().replace(/\s+/g, " ")
    : null;
}

function* walk(root: string): Generator<{ path: string; isDir: boolean }> {
  yield { path: root, isDir: true };
  for (const e of Deno.readDirSync(root)) {
    const p = `${root}/${e.name}`;
    if (e.isDirectory) yield* walk(p);
    else yield { path: p, isDir: false };
  }
}

function showTree(root: string, label: string): void {
  console.log(`\n── ${label}`);
  for (const { path, isDir } of walk(root)) {
    const rel  = (path === root ? "." : path.slice(root.length + 1)) + (isDir ? "/" : "");
    const attr = getAttr(path);
    console.log(`  ${attr ? "TAINTED" : "clean  "} ${rel.padEnd(22)} ${attr ?? "(none)"}`);
  }
}

function fixFile(filePath: string): void {
  const slash  = filePath.lastIndexOf("/");
  const parent = filePath.slice(0, slash);
  const name   = filePath.slice(slash + 1);
  new Deno.Command("docker", {
    args: [
      "run", "--rm", "-v", `${parent}:/work`, "ubuntu:22.04", "bash", "-c",
      'cp -p "/work/$1" "/work/$1.tmp" && mv "/work/$1.tmp" "/work/$1"',
      "--", name,
    ],
    stdout: "null", stderr: "null",
  }).outputSync();
}

function fixDir(dirPath: string): void {
  const slash  = dirPath.lastIndexOf("/");
  const parent = dirPath.slice(0, slash);
  const name   = dirPath.slice(slash + 1);
  const script = [
    'perms=$(stat -c "%a" "/work/$1")',
    'mtime=$(stat -c "%Y" "/work/$1")',
    'mv "/work/$1" "/work/$1.tmp"',
    'mkdir "/work/$1"',
    'chmod "$perms" "/work/$1"',
    'find "/work/$1.tmp" -maxdepth 1 -mindepth 1 -print0 | xargs -0r mv -t "/work/$1/"',
    'touch -d "@$mtime" "/work/$1"',
    'rmdir "/work/$1.tmp"',
  ].join(" && ");
  new Deno.Command("docker", {
    args: ["run", "--rm", "-v", `${parent}:/work`, "ubuntu:22.04", "bash", "-c", script, "--", name],
    stdout: "null", stderr: "null",
  }).outputSync();
}

function fixTree(root: string): void {
  showTree(root, "BEFORE");
  const tainted = [...walk(root)].filter(e => getAttr(e.path) !== null);
  for (const { path } of tainted.filter(e => !e.isDir)) fixFile(path);
  const dirs = tainted.filter(e => e.isDir)
    .sort((a, b) => b.path.split("/").length - a.path.split("/").length);
  for (const { path } of dirs) fixDir(path);
  showTree(root, "AFTER");
}

// ── Demo ──────────────────────────────────────────────────────────────────────
const ROOT = new URL("data", import.meta.url).pathname;
try { Deno.removeSync(ROOT, { recursive: true }); } catch { /* ok */ }
Deno.mkdirSync(`${ROOT}/subdir/deep`, { recursive: true });
Deno.writeTextFileSync(`${ROOT}/hello.txt`, "world");
Deno.writeTextFileSync(`${ROOT}/subdir/nested.txt`, "nested");
Deno.writeTextFileSync(`${ROOT}/subdir/deep/bottom.txt`, "bottom");

fixTree(ROOT);
