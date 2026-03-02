import { fixTree, type ProgressFn } from "./xattr.ts";

const enc = new TextEncoder();

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

  let files = 0;
  let dirs = 0;
  let clean = 0;
  let fixedFiles = 0;
  let fixedDirs = 0;
  let phase = "";

  function onProgress(p: "scan" | "fix", kind: "file" | "dir" | "clean", _path: string): void {
    if (p === "scan") {
      if (kind === "file") files++;
      else if (kind === "dir") dirs++;
      else clean++;
      clearLine(`   scanning  ${files} files · ${dirs} dirs · ${clean} clean`);
    } else if (kind === "file") {
      if (phase !== "fix-file") {
        finishLine(`   scanned  ${files + dirs + clean} entries`);
        phase = "fix-file";
      }
      fixedFiles++;
      clearLine(`   fixing files  ${fixedFiles}/${files}...`);
    } else if (kind === "dir") {
      if (phase !== "fix-dir") {
        finishLine(`   fixed  ${files} files ✓`);
        phase = "fix-dir";
      }
      fixedDirs++;
      clearLine(`   fixing dirs  ${fixedDirs}/${dirs}...`);
    }
  }

  console.log(`\n── ${root}`);
  await fixTree(root, { dryRun: !doFix, onProgress: onProgress as ProgressFn });

  if (doFix && fixedDirs > 0) {
    finishLine(`   fixed  ${dirs} dirs ✓`);
    console.log(`\n   ${fixedFiles + fixedDirs} entries cleaned`);
  } else {
    finishLine(`   scanned  ${files + dirs + clean} entries`);
  }

  console.log(`\n── ${root}`);
  console.log(`   ${files + dirs + clean} total · ${files} files · ${dirs} dirs · ${clean} clean`);
}

function clearLine(s: string): void {
  Deno.stdout.writeSync(enc.encode(`\x1b[2K\r${s}`));
}

function finishLine(s: string): void {
  Deno.stdout.writeSync(enc.encode(`\x1b[2K\r${s}\n`));
}
