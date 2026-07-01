# Web Bit-transparent Playback (hướng A)

## Mục tiêu
Đưa flacdium-web tới **trần bit-perfect của trình duyệt**: bỏ resample cưỡng bức 192k + gain-node,
thêm chế độ **Bit-perfect (bypass DSP)** phát FLAC raw qua `<audio>`, chọn thiết bị ra (`setSinkId`),
badge hiển thị sample-rate/bit-depth + cảnh báo khi OS sẽ resample.

> Giới hạn nền tảng: web KHÔNG thể exclusive-mode/OS-mixer-bypass. Đây là bit-transparent tới shared mixer
> (ngang Tidal/Qobuz web). Exclusive-mode thật cần bridge native (hướng B, plan sau).

## Thay đổi
| # | File | Nội dung | Status |
|---|------|----------|--------|
| 1 | `js/storage.js` | store `bitPerfectSettings` (enabled + sinkId) | ✅ |
| 2 | `js/audio-context.js` | bỏ ép 192k; guard init bit-perfect (không MES → raw); `_connectGraph` passthrough; `setBitPerfect()` | ✅ |
| 3 | `js/flacdium-api.js` | map thêm `sampleRate/bitDepth/channels` vào track | ✅ |
| 4 | `js/player.js` | `setOutputDevice(sinkId)`; cập nhật badge specs on track load | ✅ |
| 5 | `index.html` | UI: toggle Bit-perfect + select thiết bị ra + badge now-playing | ✅ |
| 6 | `js/settings.js` | wire toggle + enumerate/populate/setSinkId + reload-hint | ✅ |

## Nguyên tắc bit-transparent
- Bit-perfect ON ở boot → không bao giờ tạo `MediaElementSource` cho `#audio-player` → phát raw.
- Toggle OFF→ON lúc đang chạy (element đã MES) → không undo được → fallback passthrough graph + nhắc reload.
- Volume dùng `el.volume`; EQ/mono/visualizer tắt trong bit-perfect (đúng bản chất).

## Quyết định mở
- Có ép volume=100% trong bit-perfect không? (mặc định: cho chỉnh, badge chuyển amber khi <100%).
