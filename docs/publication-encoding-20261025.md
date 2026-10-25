# Lossless publication encoding

This implementation supersedes the unapplied candidate described in
`lossless-size-review-20261025.md`. That recovered report remains unchanged as
historical evidence; current measured output is in `PUBLICATION-MANIFEST.json`.

The website source contains the original legacy display PNG bytes and complete
historical source records. Those originals are retained. The publication build
creates an isolated copy, removes whitespace from a reviewed JSON subset, and
recompresses only PNG IDAT streams when the result is smaller. Full-resolution
download masters, source models, attribution, source dates, and existing paths
are unchanged.

The strict validator still requires output below 1,000,000,000 bytes and every
individual file below 100,000,000 bytes. Both `npm run check` and `npm run build`
apply that validator to actual prepared publication bytes. `public/` is not the
publication output; publishing it directly would fail the total-size gate.

For PNGs, `scripts/publication-policy.json` pins the 91 original files to their
baseline hashes. Unexpected source changes fail closed. The encoding strategy
was measured in the recovered lossless review; the build reruns that strategy
and verifies CRCs, decoded pixel bytes, inflated filtered scanlines, and every
non-IDAT chunk. A temporary cache saves only deflate work; cached bytes undergo
the same comparisons. No cache file enters the published tree. Reproduction
records include Node and zlib versions because the compressed representation
can vary across implementations while the decoded image remains identical.

JSON minification strips whitespace only outside strings, preserving number
tokens, escapes, key order and string content. Files whose current byte hashes
are referenced elsewhere in public, script or documentation text are skipped.
The reviewed allowlist prevents newly added JSON from being silently transformed.

`dist/data/publication-derivatives.json`, linked from Sources, distinguishes
the current encoding hash at each retained legacy preview URL from its original
source hash. Historical `nativeOriginal` objects, upload proofs and source
snapshots keep their original byte claims. Exact original bytes remain in
`public/` and Git baseline `bdc90b554778f27160f90d329fba1e0e7e67feb6`.
The manifest's immutable recovery URLs are locators backed by local source
hash checks; no new remote download verification is claimed.

`PUBLICATION-MANIFEST.json` is regenerated after a successful build, hashes every
actual publication file, and records the validator results. The recovered
`EXPORT-MANIFEST.json` remains a historical source export record. A local build
does not authorize publication, prove a deployment, or update the live site.

Run:

```sh
node --test scripts/*.test.mjs
npm run check
npm run build
python scripts/verify-publication-pixels.py public dist
```

The final command is a separate Pillow decoder check; it requires an existing
Python environment with Pillow. The normal Node build has no new dependencies.
