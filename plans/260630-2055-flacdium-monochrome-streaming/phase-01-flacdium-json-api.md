# Phase 01 — Flacdium JSON API + Token Auth + CORS

**Repo:** Flacdium (`app/main.py`) · **Priority:** P0 (chặn 02/03/04) · **Status:** ☐

## Overview
Cho monochrome (khác origin) đọc kho nhạc + stream FLAC qua HTTP. Tái dùng `fetch_tracks()` và cơ chế HMAC `sign_username()` sẵn có — KHÔNG viết lại logic.

## Key insights
- `fetch_tracks(conn, request, lang, per_page)` đã đọc `q/uploader/artist/album/sort/tracks_page` từ query → bọc JSON là xong.
- Token = `sign_username(username)` (chuỗi `username.hmac`). Verify bằng `unsign_username()`. Không cần bảng token mới.
- `/preview/{id}` (L5459) đã hỗ trợ Range + `audio/flac` → dùng làm stream URL, chỉ cần cho nhận token.
- `current_user()` chỉ đọc cookie → thêm helper đọc cả `Authorization: Bearer` / `?token=`.

## Files
- Sửa: `app/main.py` (thêm endpoints + helper auth + CORS middleware).
- Không tạo file mới (giữ KISS; nếu >200 dòng cân nhắc tách `app/api_routes.py`).

## Steps
1. **Helper auth token**: `current_user_token(request)` — đọc `Authorization: Bearer <t>` hoặc `?token=`; `unsign_username` → tra user DB. Trả `Row|None`.
2. `GET /api/tracks` — gọi `fetch_tracks()`, trả `{items:[...], page, total, has_next}`. Mỗi item: `id,title,artist,album,album_artist,genre,year,track_number,disc_number,duration_seconds,duration_label,specs_label(bit/khz/ch),size_label,cover_url,uploader_display`. Public đọc list (không lộ file).
3. `GET /api/tracks/{id}` — 1 track JSON (404 nếu không có).
4. `POST /api/auth/login` (JSON `{username,password}`) — verify (tái dùng logic `/login`), trả `{token, username}`; sai → 401.
5. `POST /api/auth/signup` (JSON) — tái dùng logic `/signup`, tạo user → trả `{token, username}`; trùng → 409.
6. `GET /api/auth/me` — token → `{username}`; không có → 401. Cho monochrome auto-login.
7. **Stream auth**: `/preview/{id}` (+`/download`) chấp nhận token (Bearer/query) ngoài cookie, để monochrome khác origin gọi được.
8. **CORS**: thêm `CORSMiddleware` cho origin monochrome (env `MONOCHROME_ORIGIN`, mặc định `http://localhost:4173`), `allow_credentials` off (dùng token, không cookie cross-site), expose `Accept-Ranges,Content-Range`.

## Todo
- [ ] `current_user_token()` helper
- [ ] `/api/tracks`, `/api/tracks/{id}`
- [ ] `/api/auth/login|signup|me`
- [ ] `/preview` + `/download` nhận token
- [ ] CORSMiddleware + env `MONOCHROME_ORIGIN`
- [ ] Smoke test bằng curl

## Success
- `curl /api/tracks` trả JSON list đúng.
- `curl -X POST /api/auth/login` trả token; `/api/auth/me` với token trả username.
- `curl -H "Authorization: Bearer <t>" /preview/{id}` trả audio/flac + `Accept-Ranges: bytes`.
- UI Jinja2 cũ + cookie login KHÔNG đổi hành vi.

## Security
- Rate-limit `/api/auth/*` như `/login` cũ (chống brute force).
- Token = HMAC sẵn, không lộ secret. Stream vẫn yêu cầu auth (giữ login-required của Flacdium).
- CORS chỉ allow origin monochrome đã khai báo.

## Risk
- Đụng rate-limit/CSRF cũ → tách nhánh JSON, không qua form-CSRF.
- `fetch_tracks` trả thêm field nội bộ (`*_norm`, `stored_path`) → whitelist field khi serialize (KHÔNG lộ `stored_path`).
