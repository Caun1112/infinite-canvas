"use client";

import React, { useEffect, useRef, useState } from "react";

import { canvasThemes, type CanvasBackgroundMode } from "@/lib/canvas-theme";
import { useThemeStore } from "@/stores/use-theme-store";
import type { ViewportTransform } from "../types";

type InfiniteCanvasProps = {
    containerRef: React.RefObject<HTMLDivElement | null>;
    viewport: ViewportTransform;
    backgroundMode?: CanvasBackgroundMode;
    onViewportChange: (viewport: ViewportTransform) => void;
    onCanvasMouseDown?: (event: React.PointerEvent<HTMLDivElement>) => void;
    onCanvasDeselect?: () => void;
    onContextMenu?: (event: React.MouseEvent) => void;
    onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
    children: React.ReactNode;
};

export function InfiniteCanvas({ containerRef, viewport, backgroundMode = "lines", onViewportChange, onCanvasMouseDown, onCanvasDeselect, onContextMenu, onDrop, children }: InfiniteCanvasProps) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const panState = useRef({
        isPanning: false,
        startX: 0,
        startY: 0,
        initialX: 0,
        initialY: 0,
        hasMoved: false,
    });
    const scaleRef = useRef(viewport.k);
    const viewportRef = useRef(viewport);
    const frameRef = useRef<number | null>(null);
    const nextViewportRef = useRef<ViewportTransform | null>(null);
    const touchRef = useRef<{
        active: boolean;
        ids: number[];
        startDistance: number;
        startCenterX: number;
        startCenterY: number;
        initialViewport: ViewportTransform;
    }>({
        active: false,
        ids: [],
        startDistance: 0,
        startCenterX: 0,
        startCenterY: 0,
        initialViewport: viewport,
    });
    const [isSpacePressed, setIsSpacePressed] = useState(false);

    useEffect(() => {
        scaleRef.current = viewport.k;
        viewportRef.current = viewport;
    }, [viewport]);

    useEffect(
        () => () => {
            if (frameRef.current) cancelAnimationFrame(frameRef.current);
        },
        [],
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.code !== "Space") return;
            if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
            setIsSpacePressed(true);
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.code === "Space") setIsSpacePressed(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("[data-canvas-no-zoom],.ant-modal,.ant-popover,.ant-dropdown,.ant-select-dropdown,.ant-picker-dropdown")) return;

        const delta = -event.deltaY;
        const factor = Math.pow(1.1, delta / 100);
        const newScale = Math.min(Math.max(viewport.k * factor, 0.05), 5);
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const worldX = (mouseX - viewport.x) / viewport.k;
        const worldY = (mouseY - viewport.y) / viewport.k;

        onViewportChange({
            x: mouseX - worldX * newScale,
            y: mouseY - worldY * newScale,
            k: newScale,
        });
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("[data-canvas-no-zoom]")) return;
        if (target?.closest("[data-connection-create-menu]")) return;
        const isBackgroundClick = !target?.closest("[data-node-id],[data-connection-id]");

        if (event.pointerType === "touch" && isBackgroundClick) {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            panState.current = {
                isPanning: true,
                startX: event.clientX,
                startY: event.clientY,
                initialX: viewport.x,
                initialY: viewport.y,
                hasMoved: false,
            };
            return;
        }

        if (event.button === 0 && (event.ctrlKey || event.metaKey) && isBackgroundClick) {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            onCanvasMouseDown?.(event);
            return;
        }

        if (event.button === 1 || (event.button === 0 && !isSpacePressed && isBackgroundClick)) {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            panState.current = {
                isPanning: true,
                startX: event.clientX,
                startY: event.clientY,
                initialX: viewport.x,
                initialY: viewport.y,
                hasMoved: false,
            };
            document.body.style.cursor = "grabbing";
            return;
        }

        if (event.button === 0 && isSpacePressed && isBackgroundClick) {
            event.preventDefault();
        }
    };

    useEffect(() => {
        const getTouchPointers = () =>
            touchRef.current.ids
                .map((id) => activePointers.get(id))
                .filter((point): point is { x: number; y: number } => Boolean(point));
        const activePointers = new Map<number, { x: number; y: number }>();

        const handlePointerDown = (event: PointerEvent) => {
            if (event.pointerType !== "touch") return;
            activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (activePointers.size !== 2 || !containerRef.current?.contains(event.target as Node)) return;
            const ids = Array.from(activePointers.keys()).slice(-2);
            const points = ids.map((id) => activePointers.get(id)!);
            const center = midpoint(points[0], points[1]);
            touchRef.current = {
                active: true,
                ids,
                startDistance: distance(points[0], points[1]),
                startCenterX: center.x,
                startCenterY: center.y,
                initialViewport: viewportRefFromLatest(),
            };
            panState.current.isPanning = false;
        };

        const handlePointerMove = (event: PointerEvent) => {
            if (event.pointerType === "touch" && activePointers.has(event.pointerId)) {
                activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
            }
            if (touchRef.current.active) {
                const points = getTouchPointers();
                const rect = containerRef.current?.getBoundingClientRect();
                if (points.length !== 2 || !rect || touchRef.current.startDistance <= 0) return;
                const center = midpoint(points[0], points[1]);
                const initial = touchRef.current.initialViewport;
                const startLocalX = touchRef.current.startCenterX - rect.left;
                const startLocalY = touchRef.current.startCenterY - rect.top;
                const localX = center.x - rect.left;
                const localY = center.y - rect.top;
                const nextScale = Math.min(Math.max(initial.k * (distance(points[0], points[1]) / touchRef.current.startDistance), 0.05), 5);
                const worldX = (startLocalX - initial.x) / initial.k;
                const worldY = (startLocalY - initial.y) / initial.k;
                onViewportChange({
                    x: localX - worldX * nextScale,
                    y: localY - worldY * nextScale,
                    k: nextScale,
                });
                return;
            }
            if (!panState.current.isPanning) return;

            const dx = event.clientX - panState.current.startX;
            const dy = event.clientY - panState.current.startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                panState.current.hasMoved = true;
            }

            nextViewportRef.current = {
                x: panState.current.initialX + dx,
                y: panState.current.initialY + dy,
                k: scaleRef.current,
            };
            if (frameRef.current) return;
            frameRef.current = requestAnimationFrame(() => {
                frameRef.current = null;
                if (nextViewportRef.current) onViewportChange(nextViewportRef.current);
            });
        };

        const handlePointerUp = (event: PointerEvent) => {
            if (event.pointerType === "touch") {
                activePointers.delete(event.pointerId);
                if (activePointers.size < 2) touchRef.current.active = false;
            }
            if (!panState.current.isPanning) return;

            if (!panState.current.hasMoved) {
                onCanvasDeselect?.();
            }
            panState.current.isPanning = false;
            document.body.style.cursor = "default";
        };

        const viewportRefFromLatest = () => ({
            x: nextViewportRef.current?.x ?? viewportRef.current.x,
            y: nextViewportRef.current?.y ?? viewportRef.current.y,
            k: nextViewportRef.current?.k ?? scaleRef.current,
        });

        window.addEventListener("pointerdown", handlePointerDown);
        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerup", handlePointerUp);
        window.addEventListener("pointercancel", handlePointerUp);
        return () => {
            window.removeEventListener("pointerdown", handlePointerDown);
            window.removeEventListener("pointermove", handlePointerMove);
            window.removeEventListener("pointerup", handlePointerUp);
            window.removeEventListener("pointercancel", handlePointerUp);
        };
    }, [onCanvasDeselect, onViewportChange]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const preventWheelScroll = (event: WheelEvent) => event.preventDefault();
        container.addEventListener("wheel", preventWheelScroll, { passive: false });
        return () => container.removeEventListener("wheel", preventWheelScroll);
    }, [containerRef]);

    return (
        <div
            ref={containerRef}
            className="relative h-full w-full cursor-grab select-none overflow-hidden"
            style={{ background: theme.canvas.background, touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onWheel={handleWheel}
            onContextMenu={onContextMenu}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
        >
            <CanvasGrid viewport={viewport} mode={backgroundMode} />
            <div
                className="absolute origin-top-left"
                style={{
                    transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.k})`,
                }}
            >
                {children}
            </div>
        </div>
    );
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function CanvasGrid({ viewport, mode }: { viewport: ViewportTransform; mode: CanvasBackgroundMode }) {
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    if (mode === "blank") return null;

    const gridSize = 48 * viewport.k;
    const x = viewport.x % gridSize;
    const y = viewport.y % gridSize;
    const dotSize = viewport.k < 0.12 ? 0.8 : 1.15;
    const backgroundImage =
        mode === "dots" ? `radial-gradient(circle, ${theme.canvas.dot} ${dotSize}px, transparent ${dotSize + 0.2}px)` : `linear-gradient(${theme.canvas.line} 1px, transparent 1px), linear-gradient(90deg, ${theme.canvas.line} 1px, transparent 1px)`;

    return (
        <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
                backgroundImage,
                backgroundSize: `${gridSize}px ${gridSize}px`,
                backgroundPosition: `${x}px ${y}px`,
            }}
        />
    );
}
