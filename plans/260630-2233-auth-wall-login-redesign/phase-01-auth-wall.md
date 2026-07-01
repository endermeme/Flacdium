# Phase 01 — Auth Wall + Login Redesign + Profile

**Repo:** both · **Priority:** P0 · **Status:** ☐ · **Date:** 260630

## Overview
Bắt buộc login: backend gate `/api/tracks`, frontend overlay full-screen (= login card) chặn app khi chưa có token. Login 1 card, không social. Profile chỉ Sign Out.

## Key insights
- Token = HMAC có TTL đã có (`current_user_any`). `apiGet` đã gắn Bearer.
- Overlay mặc định hiện (CSS) → hết flash; ẩn sau `/api/auth/me` nếu authed.
- Login/Signup thành công → `location.reload()` (boot ~0.6s) → state sạch có token. KISS.

## Related files
- `app/main.py`: `api_tracks`, `api_track_detail` → require `current_user_any` (401).
- `index.html`: thêm `#flacdium-auth-gate` overlay + `<style>`; sửa account page (5420s) còn Sign Out.
- `js/accounts/auth.js`: `updateUI` toggle overlay; `setupGate()` bind nút; reload on success.
- `js/app.js`: gọi `authManager.setupGate()` lúc boot.

## Steps
1. BE: `api_tracks`/`api_track_detail` → `if current_user_any(request) is None: raise 401`.
2. HTML: overlay markup (h1 Flacdium, username, password, error, Sign In/Sign Up, note) + inline style. Default visible.
3. auth.js: `setupGate()` bind gate-signin→login, gate-signup→signup, show error; on success reload. `updateUI` show/hide overlay theo user.
4. app.js boot: `authManager.setupGate()`.
5. Profile/account page: bỏ cloud/clear-data, còn "Signed in as X" + Sign Out.

## Todo
- [ ] BE gate /api/tracks(/{id}) 401
- [ ] Overlay markup + style
- [ ] setupGate() + updateUI toggle
- [ ] reload on login success
- [ ] account page → Sign Out only

## Success
- Chưa login: overlay chặn, không thấy library; `curl /api/tracks` no-token → 401.
- Login đúng → app dùng được, library load.
- Logout → overlay lại.

## Risk
- Boot render home trước khi authed → fetch 401, đã catch, ẩn sau overlay. OK.
- Reload-on-login: đảm bảo token đã set trước reload.

## Security
- BE thực thi thật (không chỉ ẩn UI). Token TTL, rate-limit auth giữ nguyên.
