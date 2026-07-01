# Phase 04 — Login/Signup nối tài khoản Flacdium

**Repo:** both (`js/accounts/*`, Flacdium auth từ Phase 01) · **Priority:** P1 · **Status:** ☐ · **Depends:** 01

## Overview
monochrome dùng chung tài khoản Flacdium. Có token sẵn → vào thẳng; chưa có → login bằng tk Flacdium **hoặc** tạo mới; cùng 1 kho user nên tự đồng bộ. Màn login có dòng mô tả giải thích.

## Key insights
- monochrome `js/accounts/*` đang dùng PocketBase/Better Auth (`data.samidy.xyz`) — KHÔNG dùng self-host. Thay bằng client gọi `/api/auth/*` của Flacdium.
- Token lưu `localStorage` (vd `flacdium_token`). Auto-login: có token → `GET /api/auth/me` xác thực → set user.
- "Đồng bộ" = chung bảng `users` Flacdium; tạo trên monochrome = tạo tk Flacdium thật.

## Files
- Sửa: `js/accounts/auth.js`, `js/accounts/authApi.js`, `js/accounts/config.js` (trỏ Flacdium).
- Loại bỏ: phụ thuộc `js/accounts/pocketbase.js` (PocketBase) khỏi luồng chính.
- Sửa: UI login/signup (modal trong `index.html` / `js/app.js` header buttons L2908-2932).

## Steps
1. `authApi`: `login(u,p)`→`POST /api/auth/login`; `signup(u,p)`→`POST /api/auth/signup`; `me(token)`→`GET /api/auth/me`. Lưu/đọc token localStorage.
2. Bootstrap: nếu có token → `me()`; OK→logged-in; fail→xoá token, hiện login.
3. UI login: 2 nút **Đăng nhập** / **Tạo tài khoản**, cùng form (username+password).
4. **Dòng mô tả** dưới form (vi/en): "Dùng chung tài khoản với Flacdium. Đã có tài khoản Flacdium → đăng nhập thẳng. Chưa có → tạo mới, tài khoản tự đồng bộ cho cả 2 web."
5. Logout: xoá token localStorage, về trạng thái khách.
6. Gắn token vào stream/download request (Phase 03).
7. Gỡ hết import/khởi tạo PocketBase/Appwrite/Better Auth/OAuth khỏi luồng (Phase 05 dọn nốt UI).

## Todo
- [ ] `authApi` trỏ /api/auth/*
- [ ] Auto-login bằng token
- [ ] Form login + signup chung
- [ ] Dòng mô tả đồng bộ (vi/en)
- [ ] Logout xoá token
- [ ] Gỡ PocketBase/OAuth khỏi luồng

## Success
- Tạo tk trên monochrome → login được trên Flacdium UI cũ (chung user).
- Có token → reload vẫn logged-in (auto `me`).
- Sai mật khẩu → báo lỗi rõ; trùng username khi signup → báo 409.
- Dòng mô tả hiển thị đúng ở màn login.

## Security
- Token trong localStorage (chấp nhận self-host). HTTPS khi deploy thật.
- `/api/auth/*` rate-limited (Phase 01).
- Không log password; lỗi auth trả message chung (tránh user-enumeration ngoài signup-409).

## Risk
- PocketBase ăn sâu nhiều file → thay bằng adapter mỏng, không xoá ồ ạt gây vỡ import (stub trước, xoá sau ở Phase 05).
