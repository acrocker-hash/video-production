# Fortline hero loop

A 12.5-second silent loop for the hero media slot on the Fortline Property Advisory site.

The Fortline mark assembles first, using the same bar and foot timing as the site preloader. Its two bars then open into split-screen bands of black-and-white architecture, and a wipe with a Vermilion leading edge swaps the images. Next, three columns rise like shutters, and the middle column opens out to a full frame. The full lockup then draws on over the dimmed stairwell, and the video fades back to Carbon so the loop restarts seamlessly.

## Outputs (`out/`)

| File | Use |
|---|---|
| `fortline-hero-4x5.mp4` / `.webm` | Desktop. Matches `.hero-media{aspect-ratio:4/5}` (1080×1350) |
| `fortline-hero-16x10.mp4` / `.webm` | Mobile at 899px and below. Matches `aspect-ratio:16/10` (1600×1000) |
| `*-poster.jpg` | Still frame for the poster attribute and for reduced-motion users |

## Embed

Replace the `<img>` inside `.hero-media` with:

```html
<video class="hero-video" autoplay muted loop playsinline preload="auto"
       poster="/assets/video/fortline-hero-4x5-poster.jpg" aria-hidden="true">
  <source src="/assets/video/fortline-hero-16x10.webm" type="video/webm" media="(max-width: 899px)">
  <source src="/assets/video/fortline-hero-16x10.mp4"  type="video/mp4"  media="(max-width: 899px)">
  <source src="/assets/video/fortline-hero-4x5.webm"   type="video/webm">
  <source src="/assets/video/fortline-hero-4x5.mp4"    type="video/mp4">
</video>
```

```css
.hero-media video{width:100%;height:100%;object-fit:cover;display:block}
@media (prefers-reduced-motion:reduce){ .hero-media video{display:none} /* show the poster <img> instead */ }
```

## Re-rendering

```
node src/render.js 1080 1350 fortline-hero-4x5
node src/render.js 1600 1000 fortline-hero-16x10
node src/render.js 1080 1350 x --preview 2 4 6.5   # stills at given seconds into out/.prev-*
```

This needs Playwright (with Chromium) and ffmpeg. The timeline lives in `src/stage.html` under `window.render(t)`. The image assignments are in `src/render.js`.

## Stills

All stills come from the Adobe Stock free collection, licensed under the Alan Place Adobe account. They are kept out of git (`stills/` is ignored), and their IDs are listed below.

| ID | Use |
|---|---|
| 251739981 | Band 1: diagonal fins |
| 277643254 | Band 2: sweeping façade fins |
| 214611072 | Band 1 swap: curved glass tower |
| 379050150 | Band 2 swap: round building |
| 703565067 | Column 1: sculptural curves |
| 327019134 | Column 2, then full frame: stairwell looking up |
| 205455313 | Column 3: white curved stair |
| 440703359, 282470536 | Licensed spares: vertical fins, curved lattice |

Logo: `brand/fpa-lockup-white-accent.svg`, from the live site. The Vermilion foot is still awaiting Fortline sign-off (G2), as noted in the SVG.
