#!/usr/bin/env node
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const webDir = join(root, "web");
const tauriDir = join(webDir, "src-tauri");
const resourcesDir = join(tauriDir, "resources", "macos");
const nodeVersion = process.env.APP_NODE_VERSION || "v22.21.1";
const nodeName = `node-${nodeVersion}-darwin-arm64`;
const nodeArchive = join(resourcesDir, `${nodeName}.tar.gz`);
const nodeDir = join(resourcesDir, "node");
const apiBin = join(resourcesDir, "server");
const nextDir = join(resourcesDir, "web");

run("npm", ["run", "build"], webDir);
run("go", ["build", "-o", apiBin, "."], root);

rmSync(nextDir, { recursive: true, force: true });
mkdirSync(join(nextDir, ".next"), { recursive: true });
cpSync(join(webDir, ".next", "standalone"), nextDir, { recursive: true });
cpSync(join(webDir, ".next", "static"), join(nextDir, ".next", "static"), { recursive: true });
cpSync(join(webDir, "public"), join(nextDir, "public"), { recursive: true });
copyFileSync(join(root, "VERSION"), join(nextDir, "VERSION"));
copyFileSync(join(root, "CHANGELOG.md"), join(nextDir, "CHANGELOG.md"));

if (!existsSync(join(nodeDir, "bin", "node"))) {
    mkdirSync(resourcesDir, { recursive: true });
    if (!existsSync(nodeArchive)) {
        run("curl", ["-L", "-o", nodeArchive, `https://nodejs.org/dist/${nodeVersion}/${nodeName}.tar.gz`], root);
    }
    rmSync(nodeDir, { recursive: true, force: true });
    run("tar", ["-xzf", nodeArchive, "-C", resourcesDir], root);
    cpSync(join(resourcesDir, nodeName), nodeDir, { recursive: true });
    rmSync(join(resourcesDir, nodeName), { recursive: true, force: true });
    relinkNodeBins();
}

relinkNodeBins();

function run(command, args, cwd) {
    const result = spawnSync(command, args, { cwd, stdio: "inherit" });
    if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} 执行失败`);
}

function relinkNodeBins() {
    const binDir = join(nodeDir, "bin");
    rmSync(join(binDir, "npm"), { force: true });
    rmSync(join(binDir, "npx"), { force: true });
    rmSync(join(binDir, "corepack"), { force: true });
    symlinkSync("../lib/node_modules/npm/bin/npm-cli.js", join(binDir, "npm"));
    symlinkSync("../lib/node_modules/npm/bin/npx-cli.js", join(binDir, "npx"));
    symlinkSync("../lib/node_modules/corepack/dist/corepack.js", join(binDir, "corepack"));
}
