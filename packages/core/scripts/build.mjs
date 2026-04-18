import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = resolve(packageDir, "dist");
const cjsDir = resolve(distDir, "cjs");

function run(command) {
  execSync(command, {
    cwd: packageDir,
    stdio: "inherit"
  });
}

rmSync(distDir, { recursive: true, force: true });

run("tsc -p tsconfig.build.esm.json");
run("tsc -p tsconfig.build.cjs.json");
run("tsc -p tsconfig.build.types.json");

mkdirSync(cjsDir, { recursive: true });
writeFileSync(
  resolve(cjsDir, "package.json"),
  JSON.stringify(
    {
      type: "commonjs"
    },
    null,
    2
  )
);

