// Synchronous redraws retain the page viewport while their old content is replaced.
export function preserveViewport(draw) {
    const left = window.scrollX, top = window.scrollY;
    const body = document.body, root = document.documentElement;
    const minimum = body.style.minHeight, anchoring = root.style.overflowAnchor;
    body.style.minHeight = `${Math.max(body.offsetHeight, root.scrollHeight)}px`;
    root.style.overflowAnchor = "none";
    try {
        return draw();
    } finally {
        body.style.minHeight = minimum;
        window.scrollTo({ left, top, behavior: "instant" });
        root.style.overflowAnchor = anchoring;
    }
}
