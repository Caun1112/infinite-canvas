#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const webDir = join(root, "web");
const releaseDir = join(root, "dist", "release-assets");
const version = normalizeVersion(process.env.APP_VERSION || "v0.2.5");
const platform = process.argv[2] || "macos";
const rustupToolchainBin = join(homedir(), ".rustup", "toolchains", "stable-aarch64-apple-darwin", "bin");

if (!["macos", "ios"].includes(platform)) {
    throw new Error("用法：node scripts/build-app-release.mjs macos|ios");
}

mkdirSync(releaseDir, { recursive: true });

if (platform === "macos") {
    run("node", ["../scripts/prepare-macos-app-resources.mjs"], webDir);
    run("npx", ["--yes", "@tauri-apps/cli@2.11.3", "build", "--bundles", "app"], webDir);
    const appPath = findFirst(join(webDir, "src-tauri", "target", "release", "bundle", "macos"), ".app");
    if (!appPath) throw new Error("没有找到 macOS .app 产物");
    const output = join(releaseDir, `InfiniteCanvas_${version}_macOS_app.zip`);
    if (existsSync(output)) rmSync(output);
    run("codesign", ["--force", "--deep", "--sign", "-", appPath], root);
    run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, output], root);
    console.log(output);
} else if (platform === "ios") {
    buildStaticIosFrontend();
    rmSync(join(webDir, "src-tauri", "gen", "apple", "assets", "resources"), { recursive: true, force: true });
    rmSync(join(webDir, "src-tauri", "gen", "apple", "build"), { recursive: true, force: true });
    updateIosPrivacyDescriptions();
    run("npx", ["--yes", "@tauri-apps/cli@2.11.3", "ios", "build", "--no-sign", "--ci", "--config", JSON.stringify({ build: { frontendDist: "../out-build" }, bundle: { resources: [] } })], webDir);
    const ipaPath = findFirst(join(webDir, "src-tauri", "gen", "apple", "build"), ".ipa") || findFirst(join(webDir, "src-tauri", "target"), ".ipa");
    if (!ipaPath) throw new Error("没有找到 iOS unsigned .ipa 产物");
    const output = join(releaseDir, `InfiniteCanvas_${version}_unsigned.ipa`);
    copyFileSync(ipaPath, output);
    console.log(output);
}

function run(command, args, cwd) {
    const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: false, env: buildEnv() });
    if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} 执行失败`);
}

function buildEnv() {
    const path = process.env.PATH || "";
    return {
        ...process.env,
        PATH: existsSync(join(rustupToolchainBin, "cargo")) ? `${rustupToolchainBin}:${path}` : path,
    };
}

function buildStaticIosFrontend() {
    const hiddenFiles = [
        join(webDir, "src", "app", "(user)", "canvas", "[id]", "page.tsx"),
        join(webDir, "src", "app", "api", "[...path]", "route.ts"),
        join(webDir, "src", "app", "webdav-proxy", "route.ts"),
    ].map((path) => ({ path, hiddenPath: `${path}.ios-static` }));
    for (const file of hiddenFiles) {
        if (existsSync(file.hiddenPath)) renameSync(file.hiddenPath, file.path);
        renameSync(file.path, file.hiddenPath);
    }
    try {
        const result = spawnSync("npm", ["run", "build"], {
            cwd: webDir,
            stdio: "inherit",
            shell: false,
            env: { ...buildEnv(), NEXT_PUBLIC_STATIC_APP: "1" },
        });
        if (result.status !== 0) throw new Error("iOS 静态前端构建失败");
    } finally {
        for (const file of hiddenFiles.slice().reverse()) {
            renameSync(file.hiddenPath, file.path);
        }
    }
}

function updateIosPrivacyDescriptions() {
    const plistPath = join(webDir, "src-tauri", "gen", "apple", "app_iOS", "Info.plist");
    if (!existsSync(plistPath)) return;
    setPlistString(plistPath, "NSPhotoLibraryUsageDescription", "用于从照片图库选择图片并导入无限画布。");
    setPlistString(plistPath, "NSPhotoLibraryAddUsageDescription", "用于将画布中的图片通过系统保存到照片。");
    setPlistString(plistPath, "NSCameraUsageDescription", "用于拍摄照片或视频并导入无限画布。");
    setPlistString(plistPath, "NSMicrophoneUsageDescription", "用于拍摄视频时录制声音。");
}

function setPlistString(plistPath, key, value) {
    const add = spawnSync("/usr/libexec/PlistBuddy", ["-c", `Add :${key} string ${value}`, plistPath], { cwd: root, stdio: "ignore", shell: false });
    if (add.status === 0) return;
    run("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${value}`, plistPath], root);
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
