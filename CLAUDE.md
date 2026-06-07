# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NOCTISAK47: OVERDRIVE RAMPAGE** is a single-player action clicker game (PWA) targeting mobile browsers. It is written in pure vanilla JavaScript with no build tools, no npm, and no external frameworks. The entire application lives in a single file: `index.html`.

## Local Development

There is no build step. Serve the project over HTTP (required for Service Workers — `file://` will not work):

```bash
python -m http.server 8000
# then open http://localhost:8000
```

For mobile testing, use browser DevTools device emulation or connect a real device to the same local network.

There are no automated tests or linters configured. All verification is manual.

## Architecture

All HTML, CSS (~4,000 lines), and JavaScript (~10,000 lines) are inline in `index.html`. The three companion files are:

- **`sw.js`** — Service Worker (network-first for HTML/JS, cache-first for assets). Precaches ~150 assets.
- **`manifest.json`** — PWA manifest (fullscreen, portrait, theme `#ff2233`).
- **`/cards/`** — 70+ card artwork PNGs referenced by the card system.

### JavaScript structure (inside `<script>` blocks in `index.html`)

| Area | Description |
|------|-------------|
| `SHOP_DEF` | Array of 7 shop items (OCA, RNGESUS, DE-SO-LATER, METH SHARD, BUFF STICK, TIME SKIP CORE, STONKS HAND), each with 5 upgrade levels and cost/effect data |
| Sound system | Web Audio API (`AudioContext`) for SFX; `<audio>` elements for BGM tracks (`fight1-4.mp3`) |
| `save` object | All player progression — coins, card inventory, skill levels, mastery run counts, weekly challenge state — persisted to `localStorage` and synced to cloud (Vercel KV) |
| Hit/damage loop | Tap zones, weak-point detection, crit/overdrive multipliers, card bonuses |
| Card system | 64 cards across 4 rarities: Standard 65%, Premium 20%, Elite 13%, Mythic 2%. Mastery: NORMAL → GLOSSY at 10 runs → PRISMATIC at 30 runs |
| Particle system | Object-pooled particles, rings, and break impacts (pools at lines ~12602–12618) — do not increase per-hit particle counts |

### Game screen IDs

`#mainMenu`, `#gameScreen`, `#shopScreen`, `#bossScreen`, `#arenaScreen`, `#cardCollectionScreen`, `#rewardsModal`, `#cardModal`, `#settingsPanel` — all are children of `#gameRoot`.

## Releasing / Version Bumping

When making any change that players will receive, update the version string in **three places** to bust the Service Worker cache:

1. `index.html` line ~19: `window.NOCTISAK47_APP_VERSION = '2026.05.18.1'`
2. `index.html` `<link rel="manifest">` query param: `?v=2026.05.18.1`
3. `sw.js` line ~2: `const APP_VERSION = '2026.05.18.1'`

Version format is `YYYY.MM.DD.n` (n = daily increment).

## Key Conventions

- **Language**: UI strings and in-code comments are in Thai. Maintain this.
- **No dependencies**: Do not introduce npm packages, CDN imports, or external frameworks.
- **Performance-sensitive paths**: The tap/hit handler runs on every touch event. Avoid DOM queries, allocations, or layout-triggering reads inside it. Use the existing object pools for particles.
- **Shop balancing**: Item costs are calibrated against ~250 coins/round (60 s). Lv1 unlocks at ~15–20 rounds; Lv5 costs represent 4–8.5 hours of play. Keep new items within this economy.
- **CSS**: All styles are inline in `<style>` inside `<head>`. Use CSS custom properties and `transform`/`opacity` for animations — the layout uses `contain: layout paint` and `will-change` on animated elements.
- **localStorage key**: The save object is serialized under a single key. Any schema changes need a migration check on load to avoid wiping existing saves.
