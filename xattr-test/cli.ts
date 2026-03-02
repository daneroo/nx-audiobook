import {
  byDepthDesc,
  fixDir,
  fixFile,
  fixTree,
  sessionToken,
  toHex,
  type TokenGroup,
} from "./xattr.ts";

const enc = new TextEncoder();

// ENTRY POINT
if (import.meta.main) {
  await main();
}

// MAIN
async function main(): Promise<void> {
  const [cmd, root] = Deno.args;
  if (!cmd || !root) {
    console.error("usage: cli.ts <show|fix|dryrun> <path>");
    Deno.exit(1);
  }

  const { tokens, clean } = await fixTree(root, { dryRun: true });
  const session = await sessionToken();
  const sessionKey = session ? toHex(session) : null;

  printHeader(cmd, root, tokens.size, clean.length, totalTainted(tokens));

  if (cmd === "show") await cmdShow(tokens, clean, sessionKey);
  else if (cmd === "dryrun") cmdDryrun(tokens, clean);
  else if (cmd === "fix") await cmdFix(tokens);
  else {
    console.error(`unknown command: ${cmd}`);
    Deno.exit(1);
  }
}

function printHeader(
  cmd: string,
  root: string,
  tokenCount: number,
  cleanCount: number,
  taintedCount: number,
): void {
  const total = taintedCount + cleanCount;
  const s = tokenCount === 1 ? "" : "s";
  console.log(`\n── ${cmd}  ${root}`);
  console.log(
    `   ${total} total · ${taintedCount} tainted · ${cleanCount} clean · ${tokenCount} session token${s}`,
  );
}

async function cmdShow(
  tokens: Map<string, TokenGroup>,
  clean: string[],
  sessionKey: string | null,
): Promise<void> {
  for (const [key, g] of tokens) {
    const marker = key === sessionKey ? "   ← this session" : "";
    console.log(`\n   ${key}${marker}`);
    console.log(
      `   local-user · ${g.files.length} files · ${g.dirs.length} dirs`,
    );
  }
  if (clean.length > 0) {
    console.log(
      `\n   ${clean.length} clean  (no xattr — pre-2022 or already fixed)`,
    );
  }
}

function cmdDryrun(tokens: Map<string, TokenGroup>, clean: string[]): void {
  const files = [...tokens.values()].reduce((n, g) => n + g.files.length, 0);
  const dirs = [...tokens.values()].reduce((n, g) => n + g.dirs.length, 0);
  console.log(`\n   would fix  ${String(files).padStart(3)} files`);
  console.log(`   would fix  ${String(dirs).padStart(3)} dirs`);
  console.log(
    `   skip       ${String(clean.length).padStart(3)} clean entries`,
  );
}

async function cmdFix(tokens: Map<string, TokenGroup>): Promise<void> {
  const files = [...tokens.values()].flatMap((g) => g.files);
  const dirs = [...tokens.values()]
    .flatMap((g) => g.dirs)
    .sort(byDepthDesc);

  writeSync(`\n   fixing ${files.length} files... `);
  for (const f of files) await fixFile(f);
  writeSync("✓\n");

  writeSync(`   fixing  ${dirs.length} dirs...  `);
  for (const dir of dirs) await fixDir(dir);
  writeSync("✓\n");

  console.log(`\n   ${files.length + dirs.length} entries cleaned`);
}

function totalTainted(tokens: Map<string, TokenGroup>): number {
  return [...tokens.values()].reduce(
    (n, g) => n + g.files.length + g.dirs.length,
    0,
  );
}

function writeSync(s: string): void {
  Deno.stdout.writeSync(enc.encode(s));
}
