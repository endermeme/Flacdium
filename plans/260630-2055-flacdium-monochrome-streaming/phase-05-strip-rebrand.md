# Phase 05 — Gỡ feature TIDAL + nút + Rebrand Flacdium

**Repo:** flacdium-web · **Priority:** P1 · **Status:** ☐ · **Độc lập (song song được)**

## Overview
Xoá UI thừa (GitHub/Discord/Donate/Unreleased), gỡ feature không có data Flacdium, đổi thương hiệu "Monochrome"→"Flacdium". Giữ player gọn + browse + search + album/artist + queue + favorites (IndexedDB).

## Bỏ — nút/trang
- **GitHub**: `index.html` star btn ~6090-6102, bottom-nav ~1824-1829; `js/app.js` import svg L2/L4, repo URL L533/540; `js/storage.js` toggle github L2467.
- **Discord**: `index.html` bottom-nav ~1812-1817; `public/discord.html`; storage L2466.
- **Donate**: `index.html` nav ~1769-1780 + section 6054-6104; `js/router.js` 120-121; `js/ui.js` loadDonateGoal 273/2471-2515; `js/commandPalette.js` 201-207; `functions/donate/*`; storage L2463.
- **Unreleased/Tracker**: `index.html` nav ~1763-1768; `js/router.js` 93-106; `js/tracker.js` (renderUnreleasedPage); `functions/unreleased/*`; storage L2462.

## Bỏ — feature không có data Flacdium
- Lyrics, recommendations/Home-Explore, listening parties, podcasts, Genius, artist recommendations, Q-DL download manager (TIDAL).
- `functions/`: parties, podcasts, donate, unreleased, userplaylist (cloud) — xoá theo route đã gỡ.

## Giữ
- Library browse, search, album/artist view (derive từ tag), player + butterchurn visualizer, queue, favorites/history (IndexedDB local).

## Rebrand → Flacdium
- `index.html`: sidebar `<span>Monochrome</span>` L1731 → `Flacdium`; logo `<use svg=...monochrome-logo.svg>` L1728 → logo Flacdium; title/meta/og/apple-touch L65/81/83.
- `public/manifest.json` L2-3 `name/short_name` → "Flacdium".
- Thay asset logo: `images/monochrome-logo.svg` → logo Flacdium (tạo/đặt mới).

## Steps
1. Gỡ nút GitHub/Discord/Donate/Unreleased ở `index.html` + handler `js/app.js` + toggle `js/storage.js`.
2. Gỡ route + render tương ứng `js/router.js`, `js/tracker.js`, `js/ui.js`, `js/commandPalette.js`.
3. Xoá `functions/` thừa + `public/discord.html`.
4. Gỡ feature TIDAL-only (lyrics/recs/parties/podcasts/genius) khỏi render + import.
5. Rebrand text + logo + manifest.
6. Build thử để bắt import vỡ (Phase 06 lo build chính).

## Todo
- [ ] Gỡ 4 nút + handler + toggle
- [ ] Gỡ route/render Donate/Unreleased
- [ ] Xoá functions/ + discord.html thừa
- [ ] Gỡ lyrics/recs/parties/podcasts/genius
- [ ] Rebrand text+logo+manifest "Flacdium"

## Success
- Sidebar không còn GitHub/Discord/Donate/Unreleased.
- Logo + tên = "Flacdium" mọi nơi (tab title, manifest, sidebar).
- Không route chết / 404 nội bộ; không import vỡ khi build.

## Risk
- Xoá ồ ạt làm vỡ import chéo → gỡ theo cụm + build kiểm tra từng cụm.
