# Readable downloaded paper names

Date checked on Windows: 2026-09-19 (Asia/Shanghai).

Paper downloads now use the same descriptive local filename in the request/append path and the native downloadFile path. The document viewer receives that saved file path, including its readable basename.

Examples:

- `9709_s25_qp_13.pdf` -> `9709_2025_夏季_P13_原卷.pdf`
- `9709_s25_ms_13.pdf` -> `9709_2025_夏季_P13_参考答案.pdf`
- `0580_m24_qp_12.pdf` -> `0580_2024_春季_P12_原卷.pdf`
- `9702_w23_ms_42.pdf` -> `9702_2023_秋冬季_P42_参考答案.pdf`

Competition filenames keep their source title with a subject prefix. Only the existing public paper origin/path allowlist may determine named files; signed/private/foreign URLs retain the native temporary-file path. Existing files saved outside the Mini Program are not renamed.

Verification:

- PDF naming, viewer-path propagation, QP/MS distinction, season/year/component separation, unsafe URL rejection and request/append path tests pass.
- `npm run test:all` exits 0. The independent package inventory test was aligned with the legacy route exclusions already in the release builder.
- Runtime budget: 231 files, 1,965,981 bytes, headroom 131,171 bytes. Whitespace in the touched downloader module was compacted without changing the 128 KiB gate.
- Actual developer-tool module returns the expected Chinese filename. The opt-in real download probe did not complete: first an automation connection timeout, then a download completion timeout after the automation connection recovered. Real phone save/share naming remains unverified.
- No share/message was sent. The isolated probe's directory was cleaned; user-owned stored files were not renamed or removed.
- Previous pending upload task for 1.0.15 was checked and returned `execution_success` (1,886,686 bytes); no duplicate upload was issued.

Reference API: [WeChat downloadFile](https://developers.weixin.qq.com/miniprogram/dev/api/network/download/wx.downloadFile.html), [WeChat openDocument](https://developers.weixin.qq.com/miniprogram/dev/api/file/wx.openDocument.html). The documentation pages could not be fetched in this environment; behavior was checked through the local runtime API contracts and callback tests rather than assuming an unsupported openDocument filename property.
