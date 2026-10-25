# Read-only lossless size option

No public file, image master, proof, reference URL or publishing limit has been changed by this analysis. Candidate PNG bytes are held only in separate scratch copies and are not part of the review branch.

## Exact measured totals

- Current recovered review, full-inventory projection: **1,006,003,847 bytes**.
- Strict maximum allowed: **999,999,999 bytes**. Current gap: **6,003,848 bytes**.
- All 137 JSON files are semantically minifiable by 4,168,403 bytes, but 49 have byte hashes referenced by other proofs/validators. They are excluded from the conservative option, not silently changed.
- Conservative 88-JSON subset: **2,767,004 bytes saved**. Alone, this leaves **3,236,844 bytes** still needed.
- 91 pinned legacy preview PNGs: **464,921,126 → 459,477,560 bytes**, saving **5,443,566 bytes**.
- Conditional combined total: **997,793,277 bytes**, leaving **2,206,722 bytes** below the strict maximum before any additional derived-version/provenance records and final inventory regeneration.

This is a measured candidate, not an implemented size pass, full build, browser pass or publication approval. It is not headroom for broader model expansion.

## What was proven

Each PNG source was fetched from the pinned baseline and checked against its original SHA-256 and size. Only IDAT zlib bytes were recompressed; every other chunk was copied verbatim. Decoded pixel bytes, dimensions, mode and decompressed filtered scanlines match. All colour, authorship, attribution and other non-IDAT metadata remain byte-identical. CRCs were checked. Original public PNG hashes were checked again after the batch. Nonpositive candidates retain their original bytes.

No release original-download master was read or modified. The target list contains only the 91 existing local `gallery/previews/…/*.png` assets. The technical package supplies per-file original/candidate hashes, pixel/scanline/metadata hashes, dimensions, byte changes and reproducible scripts.

## Reference integrity is not automatic

All 91 PNGs have byte-hash records outside the export inventory. The audit found 190 historical-snapshot references, 99 retained source/native-original references and 33 historical original-upload proof references. No direct active-validator literal PNG hash assertion was found in the inspected scripts, but that does NOT make the old source claims disposable.

Thus **safe unpinned PNG savings are zero**. Every changed PNG needs an explicit derived/version record and a review of current references before any implementation. Do not replace a historical original SHA with a candidate SHA or claim that recompressed bytes were the originally verified upload. Preserve the original SHA/byte record and its recoverable pinned baseline source. An approved derived-version policy may retain display URLs while honestly identifying transformed bytes; that policy has not been implemented or approved here.

The package's `png-hash-reference-audit.json` lists exact JSON pointers, not just broad file names. Current-versus-historical distinctions must survive any later change. An approved implementation must regenerate the export inventory and rerun complete link/hash/media tests plus permitted browser QA, then measure the final total including provenance overhead.

## Alternative architecture decision

Moving or omitting these 91 previews could remove 464,921,126 bytes from Pages, but would change source access/reference obligations and break existing URLs if done naively. The package retains an exact migration inventory and rollback plan. That migration is **not established as necessary** if the conditional lossless/versioning option is accepted. Neither option is authorized by this report.
