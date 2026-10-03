# AP/IB native PDF download repair — 1.0.27

The 1.0.26 native downloader used an open-ended Range request. A failed first
response could lose the entire in-memory PDF while the UI claimed progress had
been saved. Native simulator reproduction of an IB original reached timeout
with zero saved bytes. Earlier HEAD/Range probes and visible download buttons
did not test the actual native download/filesystem/viewer handoff.

The shared PDF controller now uses 128 KiB chunks with persistent, bounded
checkpoints. Each segment verifies Content-Range, Content-Length, type, total
and strong ETag. AP/IB catalog byte count and SHA-256 verify the completed file.
Different files/accounts have separate named paths. Retry and page re-entry
recover saved offsets; background return and restored connectivity resume
interrupted downloads, while explicit cancellation remains stopped. Transient
segment errors have two bounded retries. Corrupt or changed source data cannot
be appended or opened.

Verification includes binary fixture failures and corruption, full native
regression and compilation, then real AP/IB network transfers and filesystem
checks in the official simulator. Only the document-viewer callback is mocked
where the simulator cannot supply a physical WeChat viewer; that scope is
reported separately. Physical iOS/Android document viewing and mainland-network
timings are not inferred from simulator results.

The release version continues from 1.0.26 as 1.0.27, using the maintained
incrementing upload wrapper and frozen source manifest.
