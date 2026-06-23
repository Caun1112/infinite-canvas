"use client";

import { useSearchParams } from "next/navigation";

import CanvasClientPage from "../[id]/canvas-client-page";

export default function CanvasStaticPage() {
    const searchParams = useSearchParams();
    return <CanvasClientPage projectIdOverride={searchParams.get("id") || undefined} />;
}
