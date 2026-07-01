# Flacdium × monochrome — Bit-perfect Streaming Web

## Mục tiêu
Biến monochrome (UI TIDAL) thành **web streaming bit-perfect** riêng, lấy nhạc từ **chung kho** với Flacdium.

## Kiến trúc đã chốt
- **2 web riêng**, đứng song song, **chung kho nhạc**.
- **Flacdium** = nguồn sự thật: giữ DB + kho FLAC + UI Jinja2 cũ (không đụng). Thêm **JSON API** + **token auth** + **CORS**.
- **monochrome** (`~/Desktop/flacdium-web`) = web client riêng. Bỏ backend TIDAL, gọi API Flacdium, stream FLAC qua `/preview/{id}` (native, bit-perfect — bypass HLS/Shaka/SW-decrypter).
- **Account dùng chung**: token Flacdium → vào thẳng; chưa có → login bằng tk Flacdium hoặc tạo mới (cùng 1 kho user → tự đồng bộ). Màn login có dòng mô tả giải thích.

## Nguồn (anchors đã verify)
- Backend: `app/main.py` — `fetch_tracks()` L3828, `current_user()` L1859, `sign_username/unsign_username` L1673/1677, `/preview/{id}` L5459 (Range OK), `/covers` mount L829.
- Frontend: `~/Desktop/flacdium-web` — `js/api.js` (LosslessAPI), `js/player.js:1280` (direct-audio branch), `index.html` (sidebar/nav/donate), `js/accounts/*` (auth), `vite.config.ts`.

## Phases
| # | Tên | Repo | Status |
|---|-----|------|--------|
| 01 | [Flacdium JSON API + token auth + CORS](phase-01-flacdium-json-api.md) | Flacdium | ✅ DONE (curl 8/8) |
| 02 | [monochrome → Flacdium API adapter](phase-02-monochrome-api-adapter.md) | flacdium-web | ✅ code+build OK, chưa E2E |
| 03 | [Bit-perfect playback qua /preview](phase-03-bitperfect-playback.md) | flacdium-web | 🔄 audioUrl wired; cần crossOrigin + E2E |
| 04 | [Login/signup nối tk Flacdium](phase-04-auth-login-ui.md) | both | ☐ (API sẵn, UI modal chưa) |
| 05 | [Gỡ feature TIDAL + nút + rebrand Flacdium](phase-05-strip-rebrand.md) | flacdium-web | 🔄 sidebar/title/manifest done; còn pages/functions/storage |
| 06 | [Tối ưu đồ họa/load/tải + build + test](phase-06-perf-build-test.md) | both | 🔄 fix build config (bỏ chunk ma); còn gỡ shaka/hls |

## Dependencies
- 02,03,04 phụ thuộc 01 (API + token có trước).
- 06 chạy cuối (sau khi luồng data thông).
- 05 độc lập, làm song song được.

## Quyết định mở
- Domain/port deploy monochrome (mặc định: vite preview/host riêng, CORS trỏ về Flacdium).
- Có cần `/api/albums`, `/api/artists` riêng hay derive client-side từ track tags (mặc định: derive client-side, KISS).
