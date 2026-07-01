# Phase 03 — Bit-perfect Playback qua /preview

**Repo:** flacdium-web (`js/player.js`) · **Priority:** P0 · **Status:** ☐ · **Depends:** 01,02

## Overview
Phát FLAC native bit-perfect bằng cách set `<audio>.src = /preview/{id}`, **bypass toàn bộ** pipeline HLS.js/Shaka/sw-decrypter của TIDAL.

## Key insights
- monochrome đã có nhánh direct-audio (`js/player.js:1280`): `if (isTracker || (track.audioUrl && !track.isLocal))` → set `activeElement.src = streamUrl` (L834). Flacdium track có `audioUrl` → tự rơi vào nhánh này.
- Browser phát FLAC native (Chromium/Firefox OK). Range do `/preview` hỗ trợ → seek mượt.
- Service worker `sw-decrypter.js` chỉ cần cho TIDAL HLS → tắt cho Flacdium track.

## Files
- Sửa: `js/player.js` (đảm bảo Flacdium track đi nhánh direct, gắn token vào src nếu cần auth).
- Sửa/loại: đăng ký `sw-decrypter` (vite-plugin-pwa) — không decrypt cho FLAC.
- Tham chiếu: `index.html:149` `<audio id="audio-player">`.

## Steps
1. Trong resolve stream URL: nếu `track.isFlacdium` → `streamUrl = track.audioUrl (+ '?token='+token nếu private)`. Bỏ qua manifest/HLS.
2. Đảm bảo `audioUrl && !isLocal` → vào nhánh direct (L1280). Set `crossOrigin='anonymous'` cho visualizer (Web Audio) hoạt động cross-origin.
3. Visualizer butterchurn: nối `MediaElementSource(audio-player)` — giữ nguyên, chỉ cần CORS audio OK (Phase 01 expose header).
4. Tắt nhánh decrypt SW cho request /preview (SW chỉ xử lý TIDAL host).
5. Seek/duration: dùng `duration_seconds` từ API + native `audio.duration` fallback.

## Todo
- [ ] Flacdium track → direct-audio branch
- [ ] Token gắn vào /preview nếu private
- [ ] `crossOrigin='anonymous'` cho visualizer
- [ ] SW không decrypt FLAC
- [ ] Seek + duration đúng

## Success
- Bấm play → nghe FLAC, không qua Shaka/HLS (Network tab chỉ thấy /preview với 206 Partial).
- Seek tua được (Range 206).
- Visualizer chạy (nếu bật).
- Không lỗi console về decrypt key.

## Risk
- crossOrigin + thiếu CORS header → audio im lặng/visualizer chết → Phase 01 phải expose `Access-Control-Allow-Origin` cho /preview.
- Token lộ trong URL query (log) → chấp nhận cho self-host; hoặc dùng cookie SameSite=None nếu cùng site-domain.
