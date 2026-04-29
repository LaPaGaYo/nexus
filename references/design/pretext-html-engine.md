# Pretext HTML Engine Reference

Use this reference when `/design-html` lazy-loads Pretext wiring details.

## Pattern 1: Basic Height Computation

Use for simple layouts and card/grid text blocks.

```js
import { prepare, layout } from './pretext-inline.js'

await document.fonts.ready
const prepared = new Map()
for (const el of document.querySelectorAll('[data-pretext]')) {
  prepared.set(el, prepare(el.textContent, getComputedStyle(el).font))
}

function relayout() {
  for (const [el, handle] of prepared) {
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight)
    const { height } = layout(handle, el.clientWidth, lineHeight)
    el.style.height = `${height}px`
  }
}

new ResizeObserver(() => relayout()).observe(document.body)
relayout()
```

## Pattern 2: Shrinkwrap Containers

Use `prepareWithSegments(text, font)` plus `walkLineRanges(segs, width, onLine)` to find tight-fit widths for chat bubbles or label-like text blocks.

## Pattern 3: Text Around Obstacles

Use `layoutNextLine(segs, state, width, lineHeight)` when each line has a different available width because an image, pull quote, or floating object occupies part of the measure.

## Pattern 4: Complex Editorial Rendering

Use `layoutWithLines(segs, width, lineHeight)` when you need full line-by-line output for Canvas, SVG, or custom positioned DOM.

## API Reference

| API | Purpose |
|-----|---------|
| `prepare(text, font)` | One-time measurement after `document.fonts.ready`. |
| `layout(handle, width, lineHeight)` | Resize-time height and line-count computation. |
| `prepareWithSegments(text, font)` | Enables line-level layout APIs. |
| `layoutWithLines(segs, width, lineHeight)` | Full line breakdown for Canvas/SVG/custom DOM. |
| `walkLineRanges(segs, width, onLine)` | Find tight-fit widths for shrinkwrap containers. |
| `layoutNextLine(segs, state, width, lineHeight)` | Iterative layout with per-line widths for obstacles. |
| `clearCache()` / `setLocale(locale?)` | Cache and locale controls for advanced runs. |
