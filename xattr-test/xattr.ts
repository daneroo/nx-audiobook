import { walk } from "@std/fs/walk";
import { parse } from "@std/path";

const ATTR = "com.apple.provenance";
const IMAGE = "alpine:3.23";
const d = new TextDecoder();

export type TokenGroup = { bytes: Uint8Array; files: string[]; dirs: string[] };

export type ProgressFn = (
  phase: "scan" | "fix",
  kind: "file" | "dir" | "clean",
  path: string,
) => void;

export async function fixTree(
  root: string,
  opts: { dryRun?: boolean; onProgress?: ProgressFn } = {},
): Promise<{ tokens: Map<string, TokenGroup>; clean: string[] }> {
  const result = await scan(root, opts.onProgress);

  if (!opts.dryRun) {
    const groups = [...result.tokens.values()];
    const files = groups.flatMap((g) => g.files).sort();
    const dirs = groups.flatMap((g) => g.dirs).sort(byDepthDesc);
    for (const path of files) {
      await fixFile(path);
      opts.onProgress?.("fix", "file", path);
    }
    for (const path of dirs) {
      await fixDir(path);
      opts.onProgress?.("fix", "dir", path);
    }
  }

  return result;
}

export async function fixFile(filePath: string): Promise<void> {
  const { dir, base } = parse(filePath);
  const tmp = `${base}.tmp`;
  // deno-fmt-ignore
  const r = await new Deno.Command("docker", {
    args: [
      "run", "--rm", "-v", `${dir}:/work`, "-w", "/work",
      IMAGE, "sh", "-c", `cp -p -- "${base}" "${tmp}" && mv -- "${tmp}" "${base}"`,
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
    `mv -- "${base}" "${tmp}"`,
    `mkdir -m ${octal} -- "${base}"`,
    `find "${tmp}" -maxdepth 1 -mindepth 1 -print0 | xargs -0r mv -t "${base}/"`, // mv tmp/* base — glob misses dotfiles and fails on empty dir
    `touch -d @${epoch} -- "${base}"`,
    `rmdir -- "${tmp}"`,
  ].join(" && ");
  // deno-fmt-ignore
  const r = await new Deno.Command("docker", {
    args: ["run", "--rm", "-v", `${dir}:/work`, "-w", "/work", IMAGE, "sh", "-c", script],
    stdout: "null", stderr: "null",
  }).output();
  if (r.code !== 0) throw new Error(`fixDir failed: ${dirPath}`);
}

export async function sessionToken(): Promise<Uint8Array | null> {
  const tmp = await Deno.makeTempFile();
  try {
    return await getAttr(tmp);
  } finally {
    await Deno.remove(tmp);
  }
}

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

export async function getAttr(path: string): Promise<Uint8Array | null> {
  const r = await new Deno.Command("xattr", {
    args: ["-px", ATTR, path],
    stderr: "null",
  }).output();
  return r.code === 0 ? fromHex(d.decode(r.stdout)) : null;
}

export function toHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join(" ");
}

export function fromHex(s: string): Uint8Array {
  return Uint8Array.from(s.trim().split(/\s+/), (x) => parseInt(x, 16));
}

export function byDepthDesc(a: string, b: string): number {
  return b.split("/").length - a.split("/").length;
}

async function scan(root: string, onProgress?: ProgressFn): Promise<{
  tokens: Map<string, TokenGroup>;
  clean: string[];
}> {
  const tokens = new Map<string, TokenGroup>();
  const clean: string[] = [];
  for await (const { path, isFile, isDirectory } of walk(root)) {
    const attr = await getAttr(path);
    if (!attr) {
      clean.push(path);
      onProgress?.("scan", "clean", path);
      continue;
    }
    const key = toHex(attr);
    if (!tokens.has(key)) tokens.set(key, { bytes: attr, files: [], dirs: [] });
    const g = tokens.get(key)!;
    if (isFile) {
      g.files.push(path);
      onProgress?.("scan", "file", path);
    } else if (isDirectory) {
      g.dirs.push(path);
      onProgress?.("scan", "dir", path);
    }
  }
  return { tokens, clean };
}
