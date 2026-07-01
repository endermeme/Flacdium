# Phase 02 — monochrome → Flacdium API Adapter

**Repo:** flacdium-web (`js/api.js`) · **Priority:** P0 · **Status:** ☐ · **Depends:** 01

## Overview
Thay backend TIDAL của monochrome bằng adapter gọi API Flacdium. Map Flacdium track JSON → shape `Track/Album/Artist` mà UI monochrome đang dùng (`js/container-classes.ts`).

## Key insights
- `LosslessAPI` (`js/api.js:56`) là tầng data duy nhất (search/metadata/stream URL/cache). Thay class này = thay backend.
- monochrome Track shape: `{id,title,duration,artist{id,name},artists[],album{id,title,cover,...},trackNumber,audioQuality,audioUrl}`.
- Flacdium không có album/artist ID → derive ID ổn định = slug(normalize(name)) client-side. KISS, không thêm API.

## Files
- Sửa: `js/api.js` (thay thân `LosslessAPI` → gọi `FLACDIUM_BASE/api/*`).
- Sửa: `js/config*`/nơi khai base URL → thêm `FLACDIUM_BASE` (env/window var).
- Tham chiếu: `js/container-classes.ts` (giữ nguyên shape).

## Steps
1. Khai `FLACDIUM_BASE` (vd `window.FLACDIUM_BASE || 'http://localhost:8000'`).
2. `search(query)` → `GET /api/tracks?q=` → map mỗi item qua `toTrack()`.
3. `toTrack(f)`: `id=f.id`, `title=f.title`, `duration=f.duration_seconds`, `artist={id:slug(f.artist),name:f.artist}`, `album={id:slug(f.album),title:f.album,cover:f.cover_url}`, `trackNumber=f.track_number`, `audioQuality='LOSSLESS'`, `audioUrl=FLACDIUM_BASE+'/preview/'+f.id`, `isFlacdium=true`, `specs=f.specs_label`.
4. `getStreamUrl(track)` → trả `track.audioUrl` (+token nếu cần, xem 03/04). Không gọi TIDAL/Q-DL.
5. `getAlbum/getArtist` → derive client-side: filter tracks theo `album_norm`/`artist_norm` (gọi `/api/tracks?album=` hoặc `?artist=`).
6. Giữ cache (Map) như cũ để tránh refetch.
7. Bỏ/stub mọi nhánh TIDAL token, Q-DL, manifest, decrypt key.

## Todo
- [ ] `FLACDIUM_BASE` config
- [ ] `toTrack()` mapper + `slug()`
- [ ] `search()` qua `/api/tracks`
- [ ] `getStreamUrl()` → /preview
- [ ] `getAlbum/getArtist` derive
- [ ] Bỏ nhánh TIDAL/Q-DL/decrypt

## Success
- Search trong UI hiện track từ Flacdium (cover + specs đúng).
- Click album/artist → list track đúng nhóm.
- Không còn request nào ra TIDAL endpoint.

## Risk
- UI có thể gọi field TIDAL không tồn tại (isrc, copyright) → để `null`/empty an toàn, tránh crash render.
- slug trùng (2 album cùng tên khác artist) → ghép `slug(artist)+'/'+slug(album)`.
