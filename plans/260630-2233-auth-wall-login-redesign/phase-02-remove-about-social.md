# Phase 02 — Remove About + Social Buttons + PocketBase

**Repo:** flacdium-web · **Priority:** P1 · **Status:** ☐

## Steps
1. `index.html`: xóa social buttons `auth-github-btn`/`auth-discord-btn`/`auth-connect-btn`(Google)/`toggle-email-auth-btn` (5428-5431); xóa About nav `sidebar-nav-about-bottom` (1641); xóa `page-about` section (5321+); xóa script `pocketbase@0.21.3` UMD (cuối body).
2. `js/auth.js`: bỏ method `signInWithGoogle/GitHub/Spotify/Discord`, `sendPasswordReset` (đã alias; xóa hẳn).
3. `js/app.js`: bỏ handler header `header-google-auth/github-auth/discord-auth/spotify-auth` (2894-2897) nếu element đã gỡ (guarded — an toàn).
4. `js/router.js`: bỏ route `about` nếu có.

## Todo
- [ ] Xóa 4 social buttons + toggle-email
- [ ] Xóa About nav + page + route
- [ ] Xóa pocketbase UMD script
- [ ] Dọn OAuth methods auth.js

## Success
- Không còn nút social / About; build pass; không route chết.

## Risk
- Handler tham chiếu element đã gỡ → đều `if(el)` guarded. Build bắt lỗi import.
