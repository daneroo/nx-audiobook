import { walk, type WalkEntry } from "@std/fs/walk";
import { parse } from "@std/path";

const ATTR = "com.apple.provenance";
const IMAGE = "alpine:3.23";

export async function getAttr(path: string): Promise<Uint8Array | null> {
  const r = await new Deno.Command("xattr", {
    args: ["-px", ATTR, path],
    stderr: "null",
  }).output();
  if (r.code !== 0) return null;
  const hex = new TextDecoder().decode(r.stdout).trim().replace(/\s+/g, "");
  return Uint8Array.from(
    { length: hex.length / 2 },
    (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16),
  );
}

const toHex = (b: Uint8Array) =>
  Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join(" ");

export async function showTree(root: string, label: string): Promise<void> {
  console.log(`\n── ${label}`);
  for await (const { path, isDirectory } of walk(root)) {
    const rel = (path === root ? "." : path.slice(root.length + 1)) +
      (isDirectory ? "/" : "");
    const attr = await getAttr(path);
    console.log(
      `  ${attr ? "TAINTED" : "clean  "} ${rel.padEnd(22)} ${
        attr ? toHex(attr) : "(none)"
      }`,
    );
  }
}

export async function fixFile(filePath: string): Promise<void> {
  const { dir, base } = parse(filePath);
  const tmp = `${base}.tmp`;
  // deno-fmt-ignore
  const r = await new Deno.Command("docker", {
    args: [
      "run", "--rm", "-v", `${dir}:/work`, "-w", "/work",
      IMAGE, "sh", "-c", `cp -p "${base}" "${tmp}" && mv "${tmp}" "${base}"`,
    ],
    stdout: "null", stderr: "null",
  }).output();
  if (r.code !== 0) throw new Error(`fixFile failed: ${filePath}`);
}

export async function fixDir(dirPath: string): Promise<void> {
  const { dir, base } = parse(dirPath);
  const tmp = `${base}.tmp`;
  const { mode, mtime } = await Deno.stat(dirPath);
  const octal = (mode! & 0o777).toString(8);
  const epoch = Math.floor(mtime!.getTime() / 1000); // for touch -d @
  // deno-fmt-ignore
  const script = [
    `mv "${base}" "${tmp}"`,
    `mkdir -m ${octal} "${base}"`,
    `find "${tmp}" -maxdepth 1 -mindepth 1 -print0 | xargs -0r mv -t "${base}/"`, // mv tmp/* base — glob misses dotfiles and fails on empty dir
    `touch -d @${epoch} "${base}"`,
    `rmdir "${tmp}"`,
  ].join(" && ");
  // deno-fmt-ignore
  const r = await new Deno.Command("docker", {
    args: ["run", "--rm", "-v", `${dir}:/work`, "-w", "/work", IMAGE, "sh", "-c", script],
    stdout: "null", stderr: "null",
  }).output();
  if (r.code !== 0) throw new Error(`fixDir failed: ${dirPath}`);
}

export async function fixTree(root: string): Promise<void> {
  const tainted: WalkEntry[] = [];
  for await (const e of walk(root)) {
    if (await getAttr(e.path) !== null) tainted.push(e);
  }
  for (const { path } of tainted.filter((e) => e.isFile)) await fixFile(path);
  const dirs = tainted.filter((e) => e.isDirectory)
    .sort((a, b) => b.path.split("/").length - a.path.split("/").length);
  for (const { path } of dirs) await fixDir(path);
}
