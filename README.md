# Sean Shiroma — personal site

Static site: plain HTML, CSS and one JavaScript file. No build step, no frameworks, no CDN scripts.
All content is semantic HTML, so it reads fine with JavaScript off. The animated field (WebGL) is an enhancement on top.

## Structure

```
index.html                  all content (name, bio, contact, experience, projects)
style.css                   layout, light/dark tokens, @font-face + metric-matched fallback fonts
main.js                     field animation, HUD readouts, section tracker, event log, copy button
assets/favicon.svg          browser-tab icon
assets/fonts/               self-hosted fonts (woff2, latin subset) + their licences
  anton-latin.woff2
  geist-mono-latin.woff2
  OFL-Anton.txt
  OFL-GeistMono.txt
assets/photo.jpg            your portrait (add it; a placeholder shows until it exists)
assets/resume.pdf           your resume (add it; the Resume link points here)
```

## Preview locally

Serve the folder over HTTP. Opening `index.html` straight from disk (`file://`) blocks the fonts.

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

1. Push this folder to a GitHub repository (the files sit at the repo root).
2. Go to **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Choose branch `main` and folder `/ (root)`, then save.
4. The site appears at `https://<username>.github.io/<repo>/` (or `https://<username>.github.io/` if the repo is named `<username>.github.io`).

Every asset path is relative, so the site works under a sub-path as well as at a domain root.

## Adding the photo and resume

- **Photo:** save a portrait as `assets/photo.jpg`. It is shown in a 4:5 frame (cropped with `object-fit: cover`), so about 800 × 1000 px works well.
  It is shown **in grayscale by default and switches to colour on hover**. To always show colour, delete the `filter: grayscale(1) contrast(1.06)` rule on `.photo img.on` in `style.css`.
  Until the file exists, a crosshair placeholder is shown (the 404 for `assets/photo.jpg` in the browser console is expected).
- **Resume:** save a PDF as `assets/resume.pdf`. The Resume row in Contact links to it.

## Keyboard

| Key | Action |
| --- | --- |
| `T` | Toggle light / dark theme (remembered in `localStorage`) |
| `P` | Flip the field's polarity (repel ↔ attract) |
| `Tab` | Moves through the links and buttons |

The **Keys** button in the footer switches the single-key shortcuts off and on (the choice is remembered in `localStorage`).
Shortcuts are ignored while any modifier key (Shift, Ctrl, Alt, Cmd) is held, during IME composition, and while typing in a form field.
The footer hint and its toggle are hidden on touch-only devices.

## Behaviour notes

- **Theme:** follows the system light/dark setting until you press the toggle, after which your choice is remembered.
- **Reduced motion:** with `prefers-reduced-motion: reduce` the field renders one still frame (it still follows the pointer), and the tickers, glyph motion, LEDs and transitions stop.
- **No WebGL:** one static frame of the same field is computed on the CPU and drawn in a 2D canvas. Append `?gl=0` to the URL to preview this fallback. If the WebGL context is lost, the same frame is shown until the context is restored.
- **No JavaScript:** all text, links and sections still render; the field area shows a static CSS pattern. If `main.js` fails to load, the page falls back to the same no-JS styling.
- **Performance:** a single `requestAnimationFrame` loop that stops when the field is off screen (including when it is only behind the sticky header) or the tab is hidden. Device pixel ratio is capped at 2. An adaptive governor first lowers line density and simulation resolution, then skips frames, and only lowers the pixel ratio as a last resort. Its thresholds are relative to the display's own frame cadence, so a browser that caps animation at 30 Hz (iOS Low Power Mode, Chrome Energy Saver) keeps full quality. It never skips frames or lowers the pixel ratio at such a cadence, and it steps back up after sustained headroom. Shader status is read in a separate task after compiling (with `KHR_parallel_shader_compile` where available), so startup does not block input in one long task. The `CPU` readout in the field shows the measured JavaScript time per frame.
- **Ambient motion below the fold:** the isobar glyph sways, the RISC-V band steps, the LEDs next to current roles blink, and the tickers scroll, but only while they are on screen. All of these are compositor-friendly CSS animations; none add work to the rAF loop.
- **Event log:** the field's FIG.01 panel and the footer `LOG` line list real events from this visit (boot values, governor level changes, polarity flips, section changes, theme changes, shortcut toggles, copying the email, returning to the tab).

## Fonts and licences

Both fonts are self-hosted from `assets/fonts/` and used under the SIL Open Font License 1.1:

- **Anton** — Copyright 2020 The Anton Project Authors. Licence: `assets/fonts/OFL-Anton.txt`
- **Geist Mono** — Copyright 2024 The Geist Project Authors. Licence: `assets/fonts/OFL-GeistMono.txt`

`style.css` also defines size-adjusted local fallback faces (Impact / Arial Narrow / Liberation Sans Narrow for Anton; Menlo / DejaVu Sans Mono / Consolas for Geist Mono), so the layout keeps its geometry while the webfonts load or if they fail.
