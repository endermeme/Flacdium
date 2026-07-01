# Auth Wall + Login Redesign + Settings Cleanup

## Mục tiêu (brainstorm đã khóa)
Bắt buộc login mới dùng được (FE overlay + BE gate), login UI 1 card không social, profile chỉ Sign Out, bỏ About, audit Settings.

## Quyết định đã chốt
- Auth wall: **frontend overlay + backend gate** `/api/tracks(/{id})`.
- Scrobbling: **bỏ cả tab**. Instances: **xóa tab**.
- Giữ player extras: Visualizer, AutoEQ, Equalizer, Local Files.
- Profile: **chỉ Sign Out**.

## Phases
| # | Tên | Repo | Status |
|---|-----|------|--------|
| 01 | [Auth wall: BE gate + FE overlay + login redesign + profile](phase-01-auth-wall.md) | both | ✅ DONE (verified) |
| 02 | [Bỏ About + social buttons + pocketbase UMD](phase-02-remove-about-social.md) | flacdium-web | ✅ DONE |
| 03 | [Audit Settings: xóa Scrobbling/Instances/Quality/Recs/Podcasts/cloud](phase-03-settings-audit.md) | flacdium-web | ✅ DONE (Settings 0 err) |

## Nguồn (anchors)
- BE: `app/main.py` — `api_tracks`, `api_track_detail`, `current_user_any`.
- FE: `js/accounts/auth.js` (AuthManager→Flacdium), `index.html` (auth modal 907-942, social 5428-5431, about nav 1641 + page-about 5321, settings tabs 2759-2765), `js/settings.js` (handlers), `js/app.js` (boot, header auth 2894-2897).

## Cách làm
Batch edit theo cụm → 1 build + headless verify (chrome) mỗi cụm lớn → code-review cuối. Verify: overlay chặn khi chưa login, login→app dùng được, /api/tracks 401 khi no-token, About/social/settings đã gỡ không vỡ build.

## Dependencies
01 độc lập (core). 02 độc lập. 03 phụ thuộc nhẹ 01 (sidebar toggles). Làm 01→02→03.
