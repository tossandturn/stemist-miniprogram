# Source-bound question images

The native practice-set request opts into `X-STEMist-Source-Images: region-v2`.
The API returns each already reviewed question region as a PNG, rather than
requiring the phone to download an entire source page and clip it locally.

- Original PDFs, full-page PNGs, source hashes, page coordinates, marks and
  question identities are unchanged. Grading still resolves the original QP/MS.
- Version 2 includes `renderedImageSize`, calculated with floor/ceil integer
  source-pixel bounds. The client verifies the same calculation and reserves
  that aspect ratio before loading. It must not crop the image a second time.
- Only the server chooses the region from released, source-bound records. A
  client cannot supply arbitrary source rectangles or an MS file.
- Legacy descriptors/URLs and saved sessions continue to work. A server that
  does not support the opt-in still returns the supported version 1 descriptor.
- The six-question A2 gravity fixture keeps all 12 image regions and 31 parts;
  downloaded PNG bytes decrease from 2,304,386 to 1,790,949. This is an isolated
  byte measurement, not a physical-device or production latency claim.

Run `npm run test:native-practice` and the paired backend region-delivery test.
Production acceptance also requires actual image load events and saved-session
recovery, not only a successful practice-set response.
