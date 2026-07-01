# Phase 06 — Tối ưu đồ họa/load/tải + Build + Test

**Repo:** both · **Priority:** P2 · **Status:** ☐ · **Depends:** 02,03,04,05

## Overview
Sửa các vấn đề bạn nêu: đồ họa, load chậm, tải về "ngu", tối ưu kém. Rồi build monochrome + chạy thử end-to-end với kho nhạc thật.

## Tối ưu (đồ họa / load)
- **Ảnh cover**: lazy-load (`loading="lazy"`, `decoding="async"`), `width/height` cố định chống layout shift; dùng `/covers` có cache header.
- **List ảo hoá / phân trang**: list track dùng paginate API (`/api/tracks?tracks_page=`) thay vì tải hết — load nhanh.
- **Bundle**: monochrome đã có 3 commit perf (search/memory/bundle). Bỏ dep TIDAL nặng không dùng (shaka-player, hls.js, @ffmpeg, butterchurn nếu tắt visualizer) khỏi `package.json` → bundle nhỏ hẳn.
- **Skeleton/spinner** khi fetch để cảm giác nhanh.

## Tải về ("tải còn ngu")
- Download 1 bài = link thẳng `/download/{id}` (FileResponse audio/flac có sẵn, kèm token).
- Tải nhiều = `/download-bundle?ids=...` (ZIP có sẵn L5483) thay vì ffmpeg.wasm client (chậm/ngốn RAM).
- Bỏ pipeline Q-DL/ffmpeg.wasm cho metadata (FLAC từ Flacdium đã đủ tag).

## Build & serve
- `cd ~/Desktop/flacdium-web && bun install` (hoặc npm) → `vite build` → `dist/`.
- Chạy: `vite preview --host` (hoặc nginx) ở port riêng; trỏ `FLACDIUM_BASE` về Flacdium (`:8000`).
- Flacdium chạy như cũ; CORS đã cho origin monochrome (Phase 01).

## Test (delegate `tester`)
1. Backend: curl `/api/tracks`, `/api/auth/login|me`, `/preview` Range 206.
2. Frontend: search → play (Network chỉ /preview 206) → seek → favorite → download 1 + bundle.
3. Auth: signup monochrome → login Flacdium UI cũ (chung user).
4. Regression: UI Jinja2 Flacdium + cookie login cũ vẫn chạy.

## Todo
- [ ] Lazy cover + chống layout shift
- [ ] List dùng API pagination
- [ ] Gỡ dep TIDAL nặng khỏi bundle
- [ ] Download dùng /download + /download-bundle
- [ ] `vite build` pass, không lỗi
- [ ] E2E test + regression Flacdium cũ

## Success
- Load list < 1s với kho lớn (phân trang).
- Play tức thì, seek mượt, không lỗi console.
- Download 1 bài + nhiều bài OK.
- `vite build` xanh; bundle nhỏ hơn rõ so với gốc.
- Flacdium UI cũ không hồi quy.

## Risk
- Gỡ dep làm vỡ import còn sót → build bắt lỗi, sửa theo lỗi.
- FLAC lớn + Range proxy → đảm bảo `/preview` stream chunk, không load hết vào RAM.
