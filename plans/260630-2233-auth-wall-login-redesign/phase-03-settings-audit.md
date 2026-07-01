# Phase 03 — Settings Audit

**Repo:** flacdium-web · **Priority:** P1 · **Status:** ☐

## Xóa (UI sections trong index.html; handler JS guarded nên để no-op nếu khó gỡ)
- Tab **Scrobbling** (button 2761 + content: Last.fm/Libre.fm/ListenBrainz/Maloja).
- Tab **Instances** (button 2764 + content TIDAL API).
- Audio: **Streaming Quality**.
- Downloads: **Download Quality**, **Dolby Atmos**.
- Interface/Home: Recommended Songs/Albums/Artists, Jump Back In, Editor's Picks (+Shuffle/Source), Compact Artists/Albums.
- Sidebar toggles: Unreleased/Donate/Discord/GitHub/About.
- **Podcasts** browse + nav tab.
- System: cloud sync / custom-DB / PocketBase URL.

## Giữ
Appearance (theme/font/visualizer/tilt), Interface UX (modals/back/now-playing), Audio (ReplayGain/Gapless/Speed/AutoEQ/quality badges), Downloads (bulk method/folder/lossless container), Local Files, Equalizer, System (cache).

## Cách làm
- Ưu tiên xóa **block HTML** của mục (an toàn, handler `if(el)` tự skip).
- Tab nav: xóa button tab + panel tương ứng.
- Build sau mỗi cụm để bắt lỗi.

## Todo
- [ ] Xóa tab Scrobbling + Instances (nav + panel)
- [ ] Xóa Streaming/Download Quality + Dolby Atmos
- [ ] Xóa Recommended/Editor's Picks settings
- [ ] Xóa sidebar toggles mục đã bỏ
- [ ] Xóa Podcasts + cloud sync

## Success
- Settings chỉ còn mục liên quan Flacdium; build pass; mở Settings không lỗi console.

## Risk
- settings.js init đụng element đã gỡ → guarded. Verify headless mở Settings không pageerror.
