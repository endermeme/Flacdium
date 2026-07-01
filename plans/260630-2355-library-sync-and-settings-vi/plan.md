# Library Sync (server) + Settings Vietnamese

## Mục tiêu
1. Đồng bộ Favorites + Playlists + History lên DB Flacdium → dùng chung mọi trình duyệt/máy.
2. Settings: việt hóa + làm đẹp/dễ dùng.

## Quyết định (brainstorm)
- Sync: Favorites + Playlists + History · **server-of-truth** (cache IndexedDB) · last-write-wins.
- Settings: việt hóa + tổ chức lại gọn đẹp.

## Kiến trúc sync (KISS)
- Backend: bảng `user_collections(username,name,data,updated_at)` + `GET/PUT /api/userdata/{name}` (auth+is_active, whitelist, cap 4MB). Dùng 1 blob `library`.
- Frontend: tận dụng `db.exportData()/importData()` sẵn có. Boot → pull→importData; mọi write (hook `performTransaction` + 3 custom-txn) phát `flacdium-db-write` → push debounced (1.5s). `settings`/`pinned` để local.
- File mới: `js/flacdium-sync.js`. Wire: `app.js` boot `await initLibrarySync()`.

## Status
| Hạng mục | Status |
|---|---|
| Backend user_collections + endpoints | ✅ verified (GET/PUT/404/401/isolation) |
| db.js hook + sync module + boot wire | ✅ |
| CORS PUT (fix) | ✅ |
| **Cross-browser sync** (like A → server → pull B) | ✅ verified favorites_tracks 1→1 |
| Settings việt hóa + làm đẹp | ✅ verified (5 tab VI, ID giữ nguyên, 0 lỗi) |
| Final regression tổng hợp | ✅ gate/login/play/like-sync/settings-VI all green |

## Verify
- like ở browser A → `/api/userdata/library` server lưu → browser B pull có favorite. ✓
- Cùng cơ chế cho playlists/history/folders (chung export/import).

## Nguồn
- BE `app/main.py`: init_db(user_collections), api_userdata_get/put, require_active_api_user.
- FE: `js/flacdium-sync.js`, `js/db.js` (notifyDbWrite, performTransaction, addToHistory/clearHistory/updatePlaylistTracks), `js/app.js` boot.
