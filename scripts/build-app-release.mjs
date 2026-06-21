#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const webDir = join(root, "web");
const appShellConfig = join(webDir, "app-shell", "app-config.js");
const releaseDir = join(root, "dist", "release-assets");
const version = normalizeVersion(process.env.APP_VERSION || "v0.1.0");
const appUrl = process.env.APP_URL || "http://localhost:3000";
const platform = process.argv[2] || "macos";
const originalAppConfig = existsSync(appShellConfig) ? readText(appShellConfig) : null;

if (!["macos", "ios"].includes(platform)) {
    throw new Error("用法：node scripts/build-app-release.mjs macos|ios");
}

mkdirSync(releaseDir, { recursive: true });

try {
    writeFileSync(appShellConfig, `window.INFINITE_CANVAS_APP_URL = ${JSON.stringify(appUrl)};\n`);

    if (platform === "macos") {
        run("npx", ["--yes", "@tauri-apps/cli@2.11.3", "build", "--bundles", "app"], webDir);
        const appPath = findFirst(join(webDir, "src-tauri", "target", "release", "bundle", "macos"), ".app");
        if (!appPath) throw new Error("没有找到 macOS .app 产物");
        const output = join(releaseDir, `InfiniteCanvas_${version}_macOS_app.zip`);
        if (existsSync(output)) rmSync(output);
        run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, output], root);
        console.log(output);
    } else if (platform === "ios") {
        run("npx", ["--yes", "@tauri-apps/cli@2.11.3", "ios", "build", "--no-sign", "--ci"], webDir);
        const ipaPath = findFirst(join(webDir, "src-tauri", "gen", "apple", "build"), ".ipa") || findFirst(join(webDir, "src-tauri", "target"), ".ipa");
        if (!ipaPath) throw new Error("没有找到 iOS unsigned .ipa 产物");
        const output = join(releaseDir, `InfiniteCanvas_${version}_unsigned.ipa`);
        copyFileSync(ipaPath, output);
        console.log(output);
    }
} finally {
    if (originalAppConfig !== null) writeFileSync(appShellConfig, originalAppConfig);
}

function run(command, args, cwd) {
    const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: false });
    if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} 执行失败`);
}

function findFirst(dir, suffix) {
    if (!existsSync(dir)) return null;
    for (const name of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, name.name);
        if (name.name.endsWith(suffix)) return path;
        if (name.isDirectory()) {
            const found = findFirst(path, suffix);
            if (found) return found;
        }
    }
    return null;
}

function normalizeVersion(value) {
    return value.replace(/^v/, "");
}

function readText(path) {
    return readFileSync(path, "utf8");
}
