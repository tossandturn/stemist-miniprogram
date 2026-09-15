# Crop export fix QA

Windows date verified: 2026-09-15, Asia/Shanghai.

## Fix

- Crop now prefers a native 2D Canvas node and waits for the local image's `onload` before drawing.
- Export uses PNG to avoid device-specific JPEG canvas failures that can return a successful but flat-color file; the existing downstream compression/storage path remains unchanged.
- The source path returned by `wx.getImageInfo` is used when available, which avoids drawing a stale encoded route string.
- Older bases fall back to the legacy Canvas API. The result is checked with `wx.getImageInfo` before persistence.
- Hidden Canvas is moved off-screen without `opacity:0`, avoiding GPU paths that skip or flatten an invisible canvas.

## Verification

- `npm run test:crop`: PASS, including coordinate math, gesture stability/cancellation, and a 2D Canvas export regression with image-load ordering and PNG output.
- `npm run test:all`: exit 0; native photo, camera lifecycle, crop, page, WeChat compile and all existing product checks passed.
- `node ... simulator_refresh`: success.
- Real WeChat automator crop run was not executed because the current project window is not listening on `ws://127.0.0.1:9420`; this remains a physical-device/developer-tool runtime check.
- Final runtime budget: 235 files, 1,966,073 bytes, 131,079 bytes headroom; minimum is 131,072 bytes.

This patch changes no server, question data, student records or authentication configuration.
