# Documents package

`internal/documents` is the canonical document-management package. Do not add a
sibling `internal/document` package; its future-tagged stubs have been retired.

PDF generation uses `pkg/pdf` and stores the generated file in S3. IPFS pinning
is an optional, best-effort path for uploaded files when `IPFS_ENABLED=true` and
the configured IPFS node is reachable. Generated PDFs are stored in S3 but are
not currently sent through that upload pinning path.