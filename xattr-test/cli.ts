import { byDepthDesc, fixDir, fixFile, fixTree } from "./xattr.ts";
import { relative } from "@std/path";

const enc = new TextEncoder();

type Entry = { path: string; token: string };

// ENTRY POINT
// usage: cli.ts [--fix] <path>
if (import.meta.main) {
  await main();
}

// MAIN
async function main(): Promise<void> {
  const doFix = Deno.args.includes("--fix");
  const root = Deno.args.find((a) => !a.startsWith("--"));
  if (!root) {
    console.error("usage: cli.ts [--fix] <path>");
    Deno.exit(1);
  }

  const { tokens, clean } = await fixTree(root, { dryRun: true });

  const files = toEntries(tokens, "files").sort(byPath);
  const dirs = toEntries(tokens, "dirs").sort(byPathDepthDesc);
  const tainted = files.length + dirs.length;
  printHeader(root, tainted + clean.length, files.length, dirs.length, clean.length);
  printSection("files", files, root);
  printSection("dirs", dirs, root);
  if (clean.length > 0) console.log(`\n   ${clean.length} clean`);

  if (doFix && tainted > 0) await applyFix(files, dirs);

  printHeader(root, tainted + clean.length, files.length, dirs.length, clean.length);
}

function printHeader(
  root: string,
  total: number,
  files: number,
  dirs: number,
  clean: number,
): void {
  console.log(`\n── ${root}`);
  console.log(`   ${total} total · ${files} files · ${dirs} dirs · ${clean} clean`);
}

function printSection(label: string, entries: Entry[], root: string): void {
  if (entries.length === 0) return;
  const note = label === "dirs" ? "  (deepest first)" : "";
  console.log(`\n   ${label}  (${entries.length})${note}`);
  for (const { path, token } of entries) {
    console.log(`   ${compactToken(token)} - /${relative(root, path)}`);
  }
}

async function applyFix(files: Entry[], dirs: Entry[]): Promise<void> {
  console.log();
  writeSync(`   fixing ${files.length} files... `);
  for (const { path } of files) await fixFile(path);
  writeSync("✓\n");

  writeSync(`   fixing  ${dirs.length} dirs...  `);
  for (const { path } of dirs) await fixDir(path);
  writeSync("✓\n");

  console.log(`\n   ${files.length + dirs.length} entries cleaned`);
}

function toEntries(tokens: Map<string, TokenGroup>, kind: "files" | "dirs"): Entry[] {
  const result: Entry[] = [];
  for (const [token, g] of tokens) {
    for (const path of g[kind]) result.push({ path, token });
  }
  return result;
}

function byPath(a: Entry, b: Entry): number {
  return a.path.localeCompare(b.path);
}

function byPathDepthDesc(a: Entry, b: Entry): number {
  return byDepthDesc(a.path, b.path);
}

function compactToken(token: string): string {
  return `<${token.replace(/ /g, "")}>`;
}

function writeSync(s: string): void {
  Deno.stdout.writeSync(enc.encode(s));
}
