"use client";

import type { ReactNode } from "react";

import { AppTopNav } from "@/components/layout/app-top-nav";

export default function UserLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)", paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}>
            <AppTopNav />
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
    );
}
