<p align="center">
  <img src="icon-512.png" width="128" height="128" alt="Kohlrabi Workout app icon">
</p>

<h1 align="center">Kohlrabi Workout</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-green.svg" alt="License: AGPL-3.0"></a>
  <a href="https://kohlrabi.us"><img src="https://img.shields.io/badge/try%20it-live-brightgreen.svg" alt="Try it live"></a>
  <img src="https://img.shields.io/badge/PWA-offline--ready-blue.svg" alt="PWA, offline ready">
  <img src="https://img.shields.io/badge/no%20accounts-required-lightgrey.svg" alt="No accounts required">
</p>

<p align="center"><strong>A free, open-source workout tracker that respects your data. No accounts, no subscriptions, no ads — just training.</strong></p>

Kohlrabi Workout is a progressive-web-app workout tracker: log your sets, follow programs, watch your strength grow. It runs entirely in your browser — everything is stored on your device, and it works offline once installed.

**Try it live:** [kohlrabi.us](https://kohlrabi.us) · [getkohlrabi.com](https://getkohlrabi.com) · [GitHub Pages demo](https://cruciferousgreens.github.io/kohlrabi-public/)

> This repo is a snapshot of the v1.888 production build (2026-09-22), published as a starting point for the open-source project. The hosted apps above are the reference instances.

## Support Kohlrabi

Kohlrabi is free forever — no accounts, no ads, no premium tier. If it helps your training, consider buying the maintainer a coffee:

**[☕ Donate via Buy Me a Coffee](https://buymeacoffee.com/cruciferousgreens)**

Donations cover hosting and the unglamorous work that keeps a free app dependable.

## Why it exists

Workout apps kept asking for accounts, subscriptions, and access to personal data just to log a set. Kohlrabi takes the opposite stance: your training log is yours, it lives on your device, and the app asks for nothing in return. Free and open source, because tracking a workout shouldn't be a subscription.

## Features

- **Log workouts** — sets, reps, weight, RPE, and set tags, with per-exercise dumbbell weight conventions
- **Programs** — build multi-week programs with scheduled workouts, or start a blank session
- **Progression suggestions** — RPE-based double progression with exact suggested weights, based only on your real logged history
- **Exercise library** — 876 exercises with muscle heat maps, plus your own custom exercises
- **Stats** — estimated 1RM over time, volume trends, and personal records
- **Themes** — light and dark flavors, including Catppuccin and Rosé Pine palettes
- **Works offline** — installable PWA; your data is stored on-device in your browser (IndexedDB, with localStorage fallback)
- **Your data, portable** — one-tap JSON export and CSV workout import
- **Supersets, set tags, per-exercise settings** — the details lifters actually use

## Data & privacy

Everything lives in your browser's on-device storage — IndexedDB, falling back to localStorage where IndexedDB is unavailable. There is no backend, no account, no analytics, and no tracking of any kind — nothing leaves your device. That's the whole point.

The trade-off is honest: if you clear your browser data, your training history is gone. Export your data as JSON regularly (Settings → Data → Export data) — it takes one tap.

## Run it yourself (self-hosting)

Kohlrabi is a static PWA — there is no server, no database, no environment variables, and no secrets. There is no bundler or framework build either: a small script stages the repo (minus `tests/`) into `dist/`, and `make-sw.py` regenerates the service worker's cache list:

```bash
git clone https://github.com/cruciferousgreens/kohlrabi-public.git
cd kohlrabi-public
bash infra/pages-build.sh
# serve the dist/ folder with any static host
```

Then host `dist/` wherever you like:

- **Cloudflare Pages** — build command `bash infra/pages-build.sh`, output directory `dist`
- **GitHub Pages** — push the repo; the included workflow ([`.github/workflows/pages.yml`](.github/workflows/pages.yml)) stages `dist/` and deploys it on every push to `main`. That's how the live demo above is published.
- **Netlify / Vercel / any static host** — publish `dist/`
- **Your own server** — `python3 -m http.server` inside `dist/` is enough

HTTPS (or localhost) is required for the service worker, which powers offline use and home-screen installation.

## Install as an app

- **iOS** — open the site in Safari, tap Share → **Add to Home Screen**
- **Android** — open the site in Chrome, tap the menu → **Install app** (or **Add to Home screen**)

## Developing

No framework, no bundler — the app is plain HTML/CSS/JS loaded with classic `<script>` tags, on purpose (it keeps the whole thing debuggable on a phone). The only "build" steps are two small scripts: `bash infra/pages-build.sh` stages the repo into `dist/`, and `python3 make-sw.py` regenerates the service worker.

```bash
# serve the repo root and open http://localhost:8000
python3 -m http.server 8000

# run the unit suite (must be green)
node tests/run.js
```

App files live under `assets/js/` (organized by domain: `core/`, `workout/`, `pages/`, `data/`, `formulas/`, `lib/`), with `index.html` as the single entry point. `make-sw.py` regenerates the service worker and version stamps (`APP_VERSION` in that file is the user-facing version, shown in Settings → About) — run it after editing app files.

## Tech stack

- Vanilla HTML, CSS, and JavaScript — no framework, no dependencies to audit
- IndexedDB (localStorage fallback) for persistence, Service Worker for offline
- Python scripts for the build (`infra/pages-build.sh`, `make-sw.py`)
- Node's built-in test runner for the unit suite

## Contributing

Issues and pull requests are welcome. A few ground rules:

- Keep it dependency-free — that's a feature, not an accident.
- `node tests/run.js` must be green before you push.
- No personal names or contact details in code, comments, or docs.
- No analytics, no tracking, no accounts — the local-first promise is the product.

To report a security issue, **do not open a public issue with exploit details** — use GitHub's private vulnerability reporting (the Security tab) so the details stay private until a fix ships. A plain bug report is fine for anything that isn't a vulnerability.

## Third-party attribution

Some assets in this repo aren't covered by the code license below:

- **Muscle body map** (`data/sasha-male-body.svg`) — adapted from [Sasha's Body Map](https://github.com/Olkre/Sasha-s-Body-Map) by Olkre. Used non-commercially with attribution; not covered by the AGPL-3.0. If you redistribute this artwork commercially, contact the artist for a license.
- **Exercise library** (`data/exercises-db.js`) — [free-exercise-db](https://github.com/yuhonas/free-exercise-db), 876 exercises, public domain ([The Unlicense](https://unlicense.org)).
- **Extra themes** — colors from the [Catppuccin](https://github.com/catppuccin/catppuccin) palette and the [Rosé Pine](https://rosepinetheme.com) palette.
- **App icon** — adapted from [Tabler Icons](https://tabler.io/icons) (MIT).

## License

The application code is licensed under the **GNU Affero General Public License v3.0** — see [LICENSE](LICENSE). Fork it, self-host it, improve it; if you run a modified version as a hosted service, share your changes under the same license.

The muscle body-map artwork above is **not** under the AGPL-3.0 — see [Third-party attribution](#third-party-attribution).

---

<p align="center">
  ⭐ If Kohlrabi helps your training, <a href="https://github.com/cruciferousgreens/kohlrabi-public">star the repo</a> — and <a href="https://buymeacoffee.com/cruciferousgreens">consider a coffee</a> to keep it free.
</p>
