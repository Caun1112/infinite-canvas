import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseChangelog } from "@/lib/release";

const webDir = dirname(fileURLToPath(import.meta.url));
const localVersion = readFileSync(resolve(webDir, "../VERSION"), "utf8").trim() || "dev";
const localChangelog = readFileSync(resolve(webDir, "../CHANGELOG.md"), "utf8");

export default function nextConfig(phase: string): NextConfig {
    const isDev = phase === PHASE_DEVELOPMENT_SERVER;
    const isStaticApp = process.env.NEXT_PUBLIC_STATIC_APP === "1";
    const releases = parseChangelog(localChangelog);

    return {
        output: isStaticApp ? "export" : "standalone",
        trailingSlash: isStaticApp,
        distDir: isStaticApp ? "out-build" : ".next",
        images: {
            unoptimized: isStaticApp,
        },
        allowedDevOrigins: isDev ? ["*.*.*.*"] : [],
        typescript: {
            ignoreBuildErrors: true,
        },
        env: {
            NEXT_PUBLIC_APP_VERSION: localVersion,
            NEXT_PUBLIC_APP_RELEASES: JSON.stringify(releases),
            NEXT_PUBLIC_STATIC_APP: isStaticApp ? "1" : "0",
        },
    };
}
