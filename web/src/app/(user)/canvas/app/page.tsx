import { Suspense } from "react";

import CanvasStaticPage from "./static-page";

export default function CanvasAppPage() {
    return (
        <Suspense fallback={null}>
            <CanvasStaticPage />
        </Suspense>
    );
}
