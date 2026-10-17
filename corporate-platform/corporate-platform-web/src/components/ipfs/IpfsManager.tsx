'use client'

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileCheck,
  FileUp,
  Link2,
  RefreshCcw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAuth } from '@/contexts/AuthContext'
import { ipfsService, CHUNKED_UPLOAD_THRESHOLD } from '@/services/ipfs.service'
import { useChunkedUpload } from '@/hooks/useChunkedUpload'
import { Pagination } from '@/components/common/Pagination'
import type { IpfsDocumentRecord, IpfsDocumentType } from '@/types/ipfs'

const documentTypes: IpfsDocumentType[] = [
  'CERTIFICATE',
  'REPORT',
  'AUDIT_LOG',
  'PROOF',
  'UNKNOWN',
]

/** Derive a stable session key from file identity for upload resume. */
function sessionKeyFor(file: File): string {
  return `${file.name}__${file.size}__${file.lastModified}`
}

export interface DuplicateCheckResult {
  isDuplicate: boolean
  matchedBy: 'filename' | 'content-hash' | null
  existingDoc: IpfsDocumentRecord | null
  message: string
}

export interface DocumentIndex {
  byName: Map<string, IpfsDocumentRecord>
  byHash: Map<string, IpfsDocumentRecord>
}

/**
 * Builds an index of existing documents for O(1) duplicate lookups.
 * Time complexity: O(N) where N is number of documents.
 * Space complexity: O(N) map entries.
 */
export function buildDocumentIndex(documents: IpfsDocumentRecord[]): DocumentIndex {
  const byName = new Map<string, IpfsDocumentRecord>()
  const byHash = new Map<string, IpfsDocumentRecord>()

  for (const doc of documents) {
    if (doc.fileName) {
      byName.set(doc.fileName.trim().toLowerCase(), doc)
    }
    const hash = (doc.contentHash || (doc.metadata as any)?.contentHash || (doc.metadata as any)?.sha256) as string | undefined
    if (hash) {
      byHash.set(hash.trim().toLowerCase(), doc)
    }
  }

  return { byName, byHash }
}

/**
 * Checks whether a candidate file is a duplicate of an existing document.
 * Time complexity: O(1) map lookups.
 */
export function checkDuplicate(
  file: File,
  contentHash: string | null,
  index: DocumentIndex,
  referenceId?: string
): DuplicateCheckResult {
  const normalizedHash = contentHash?.trim().toLowerCase()
  if (normalizedHash && index.byHash.has(normalizedHash)) {
    const existingDoc = index.byHash.get(normalizedHash)!
    return {
      isDuplicate: true,
      matchedBy: 'content-hash',
      existingDoc,
      message: `This file appears to already be uploaded (identical content hash matching "${existingDoc.fileName}").`,
    }
  }

  const normalizedName = file.name.trim().toLowerCase()
  if (index.byName.has(normalizedName)) {
    const existingDoc = index.byName.get(normalizedName)!
    const trimmedRef = referenceId?.trim()
    const refMatch = trimmedRef && existingDoc.referenceId?.trim().toLowerCase() === trimmedRef.toLowerCase()
    const details = refMatch
      ? `"${existingDoc.fileName}" with matching reference "${existingDoc.referenceId}"`
      : `"${existingDoc.fileName}"`
    return {
      isDuplicate: true,
      matchedBy: 'filename',
      existingDoc,
      message: `This file appears to already be uploaded (matches existing document ${details}).`,
    }
  }

  return {
    isDuplicate: false,
    matchedBy: null,
    existingDoc: null,
    message: '',
  }
}

/**
 * Compute SHA-256 hash of a file using Web Crypto API.
 * Time complexity: O(S) where S is file size.
 * Space complexity: O(1) auxiliary space beyond buffer.
 */
export async function computeFileSha256(file: File | Blob): Promise<string> {
  const cryptoSubtle =
    (typeof window !== 'undefined' && window.crypto?.subtle) ||
    (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle)

  if (!cryptoSubtle) {
    throw new Error('Web Cryptography API is not available')
  }

  let buffer: ArrayBuffer
  if (typeof file.arrayBuffer === 'function') {
    buffer = await file.arrayBuffer()
  } else {
    buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(file)
    })
  }

  const hashBuffer = await cryptoSubtle.digest('SHA-256', new Uint8Array(buffer))
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

interface UploadState {
  busy: boolean
  percent: number | null
}

const idle: UploadState = { busy: false, percent: null }

export default function IpfsManager() {
  const { user } = useAuth()

  const [documents, setDocuments] = useState<IpfsDocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadType, setUploadType] = useState<IpfsDocumentType>('REPORT')
  const [uploadRef, setUploadRef] = useState('')

  const [batchFiles, setBatchFiles] = useState<File[]>([])
  const [batchPinCids, setBatchPinCids] = useState('')

  const [cidLookup, setCidLookup] = useState('')
  const [cidData, setCidData] = useState<any>(null)
  const [cidMetadata, setCidMetadata] = useState<any>(null)

  const [verifyCid, setVerifyCid] = useState('')
  const [verifyResult, setVerifyResult] = useState<any>(null)

  const [retirementId, setRetirementId] = useState('')
  const [certificateFile, setCertificateFile] = useState<File | null>(null)

  const [singleUpload, setSingleUpload] = useState<UploadState>(idle)
  const [batchUpload, setBatchUpload] = useState<UploadState>(idle)
  const [certUpload, setCertUpload] = useState<UploadState>(idle)
  const [pinBusy, setPinBusy] = useState(false)
  const [lookupBusy, setLookupBusy] = useState(false)

  const docIndex = useMemo(() => buildDocumentIndex(documents), [documents])
  const singleFileInputRef = useRef<HTMLInputElement>(null)
  const batchFileInputRef = useRef<HTMLInputElement>(null)

  const [singleFileHash, setSingleFileHash] = useState<string | null>(null)
  const [singleDuplicate, setSingleDuplicate] = useState<DuplicateCheckResult | null>(null)
  const [singleOverride, setSingleOverride] = useState(false)
  const singleHashSeq = useRef(0)

  const [batchFileHashes, setBatchFileHashes] = useState<Map<string, string>>(new Map())
  const [batchDuplicates, setBatchDuplicates] = useState<Map<string, DuplicateCheckResult>>(new Map())
  const [batchOverride, setBatchOverride] = useState(false)
  const batchHashSeq = useRef(0)

  useEffect(() => {
    if (!uploadFile) {
      setSingleDuplicate(null)
      return
    }
    const check = checkDuplicate(uploadFile, singleFileHash, docIndex, uploadRef.trim())
    if (check.isDuplicate) {
      setSingleDuplicate(check)
    } else {
      setSingleDuplicate(null)
    }
  }, [uploadFile, singleFileHash, docIndex, uploadRef])

  useEffect(() => {
    if (!batchFiles.length) {
      setBatchDuplicates(new Map())
      return
    }
    const duplicates = new Map<string, DuplicateCheckResult>()
    for (const file of batchFiles) {
      const hash = batchFileHashes.get(file.name) || null
      const check = checkDuplicate(file, hash, docIndex, uploadRef.trim())
      if (check.isDuplicate) {
        duplicates.set(file.name, check)
      }
    }
    setBatchDuplicates(duplicates)
  }, [batchFiles, batchFileHashes, docIndex, uploadRef])

  const chunked = useChunkedUpload()
  // A ref to the current section's upload controller so cancel works generically
  const activeSectionRef = useRef<'single' | 'batch' | 'cert' | null>(null)

  const filteredDocs = useMemo(() => {
    if (!uploadRef.trim()) return documents
    return documents.filter((doc) => doc.referenceId === uploadRef.trim())
  }, [documents, uploadRef])

  const totalPages = Math.max(1, Math.ceil(filteredDocs.length / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)

  const paginatedDocs = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredDocs.slice(start, start + pageSize)
  }, [filteredDocs, safePage, pageSize])

  const rowVirtualizer = useVirtualizer({
    count: paginatedDocs.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48,
    overscan: 5,
    initialRect: { width: 1000, height: 400 },
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end || 0)
      : 0

  const rowsToRender = useMemo(() => {
    if (virtualRows.length > 0) {
      return virtualRows.map((vr) => ({
        index: vr.index,
        key: vr.key,
        doc: paginatedDocs[vr.index],
        measureRef: rowVirtualizer.measureElement,
      }))
    }
    return paginatedDocs.map((doc, idx) => ({
      index: idx,
      key: doc.id || idx,
      doc,
      measureRef: undefined,
    }))
  }, [virtualRows, paginatedDocs, rowVirtualizer.measureElement])

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)

    const response = await ipfsService.listDocuments(user?.companyId)
    if (!response.success) {
      setError(response.error || 'Unable to load IPFS documents')
      setDocuments([])
      setLoading(false)
      return
    }

    const data = response.data
    const list = Array.isArray(data) ? data : (data as any)?.data || []
    setDocuments(list)
    setLoading(false)
  }, [user?.companyId])

  useEffect(() => {
    void loadDocuments()
  }, [loadDocuments])

  // Resume interrupted uploads when connectivity is restored
  useEffect(() => {
    const onOnline = () => {
      if (chunked.uploading) return
      // Nothing to auto-resume — user will re-trigger; the session is persisted
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [chunked.uploading])

  const cancelUpload = useCallback(() => {
    chunked.cancel()
  }, [chunked])

  // ---------------------------------------------------------------------------
  // Single upload
  // ---------------------------------------------------------------------------

  const handleSingleFileChange = async (file: File | null) => {
    setUploadFile(file)
    setSingleOverride(false)
    setError(null)
    setSuccess(null)

    if (!file) {
      setSingleFileHash(null)
      setSingleDuplicate(null)
      return
    }

    const immediate = checkDuplicate(file, null, docIndex, uploadRef.trim())
    if (immediate.isDuplicate) {
      setSingleDuplicate(immediate)
    } else {
      setSingleDuplicate(null)
    }

    const seq = ++singleHashSeq.current
    try {
      const hash = await computeFileSha256(file)
      if (singleHashSeq.current !== seq) return
      setSingleFileHash(hash)
      const hashCheck = checkDuplicate(file, hash, docIndex, uploadRef.trim())
      if (hashCheck.isDuplicate) {
        setSingleDuplicate(hashCheck)
      }
    } catch {
      if (singleHashSeq.current !== seq) return
      setSingleFileHash(null)
    }
  }

  const performSingleUpload = async (file: File, override = false) => {
    if (!user?.companyId) {
      setError('Choose a file and ensure company context is available.')
      return
    }

    if (!override) {
      let hash = singleFileHash
      if (!hash) {
        try {
          hash = await computeFileSha256(file)
          setSingleFileHash(hash)
        } catch {
          // ignore
        }
      }
      const dup = checkDuplicate(file, hash, docIndex, uploadRef.trim())
      if (dup.isDuplicate) {
        setSingleDuplicate(dup)
        return
      }
    }

    setError(null)
    setSuccess(null)
    activeSectionRef.current = 'single'
    chunked.reset()

    const metadata: Record<string, string> = {
      companyId: user.companyId,
      documentType: uploadType,
      referenceId: uploadRef.trim(),
      ...(singleFileHash ? { contentHash: singleFileHash } : {}),
    }

    if (file.size >= CHUNKED_UPLOAD_THRESHOLD) {
      setSingleUpload({ busy: true, percent: 0 })

      const result = await chunked.start({
        url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/ipfs/upload/chunked`,
        file,
        metadata,
        sessionKey: sessionKeyFor(file),
      })

      setSingleUpload(idle)
      activeSectionRef.current = null

      if (!result) {
        setError(chunked.error || 'Upload cancelled')
        return
      }

      setSuccess(`Uploaded file to CID ${result.cid}`)
      setUploadFile(null)
      setSingleFileHash(null)
      setSingleDuplicate(null)
      setSingleOverride(false)
      if (singleFileInputRef.current) singleFileInputRef.current.value = ''
      await loadDocuments()
      return
    }

    setSingleUpload({ busy: true, percent: null })

    const response = await ipfsService.uploadDocument(file, metadata)

    setSingleUpload(idle)
    activeSectionRef.current = null

    if (!response.success || response.data?.error) {
      setError(response.error || response.data?.error || 'Upload failed')
      return
    }

    setSuccess(`Uploaded file to CID ${response.data?.cid}`)
    setUploadFile(null)
    setSingleFileHash(null)
    setSingleDuplicate(null)
    setSingleOverride(false)
    if (singleFileInputRef.current) singleFileInputRef.current.value = ''
    await loadDocuments()
  }

  const onSingleUpload = async (event: FormEvent) => {
    event.preventDefault()
    if (!uploadFile || !user?.companyId) {
      setError('Choose a file and ensure company context is available.')
      return
    }

    if (singleDuplicate?.isDuplicate && !singleOverride) {
      return
    }

    await performSingleUpload(uploadFile, singleOverride)
  }

  const handleSingleUploadOverride = async () => {
    if (!uploadFile) return
    setSingleOverride(true)
    await performSingleUpload(uploadFile, true)
  }

  // ---------------------------------------------------------------------------
  // Batch upload — serialized, one file at a time
  // ---------------------------------------------------------------------------

  const handleBatchFilesChange = async (files: File[]) => {
    setBatchFiles(files)
    setBatchOverride(false)
    setError(null)
    setSuccess(null)

    if (!files.length) {
      setBatchFileHashes(new Map())
      setBatchDuplicates(new Map())
      return
    }

    const duplicates = new Map<string, DuplicateCheckResult>()
    const seenNames = new Set<string>()

    for (const file of files) {
      const norm = file.name.trim().toLowerCase()
      if (seenNames.has(norm)) {
        duplicates.set(file.name, {
          isDuplicate: true,
          matchedBy: 'filename',
          existingDoc: null,
          message: `This file appears to already be uploaded (duplicate file "${file.name}" selected within batch).`,
        })
      }
      seenNames.add(norm)

      const res = checkDuplicate(file, null, docIndex, uploadRef.trim())
      if (res.isDuplicate) {
        duplicates.set(file.name, res)
      }
    }
    setBatchDuplicates(new Map(duplicates))

    const seq = ++batchHashSeq.current
    const hashes = new Map<string, string>()

    for (const file of files) {
      try {
        const hash = await computeFileSha256(file)
        if (batchHashSeq.current !== seq) return
        hashes.set(file.name, hash)
        const hashCheck = checkDuplicate(file, hash, docIndex, uploadRef.trim())
        if (hashCheck.isDuplicate) {
          duplicates.set(file.name, hashCheck)
        }
      } catch {
        // Fallback to filename matching if hashing fails
      }
    }

    if (batchHashSeq.current === seq) {
      setBatchFileHashes(hashes)
      setBatchDuplicates(new Map(duplicates))
    }
  }

  const performBatchUpload = async (files: File[], override = false) => {
    if (!files.length || !user?.companyId) {
      setError('Select at least one file for batch upload.')
      return
    }

    if (!override) {
      const currentDuplicates = new Map<string, DuplicateCheckResult>()
      const seenNames = new Set<string>()

      for (const file of files) {
        const norm = file.name.trim().toLowerCase()
        if (seenNames.has(norm)) {
          currentDuplicates.set(file.name, {
            isDuplicate: true,
            matchedBy: 'filename',
            existingDoc: null,
            message: `This file appears to already be uploaded (duplicate file "${file.name}" selected within batch).`,
          })
        }
        seenNames.add(norm)

        let hash = batchFileHashes.get(file.name) || null
        if (!hash) {
          try {
            hash = await computeFileSha256(file)
          } catch {
            // ignore
          }
        }
        const res = checkDuplicate(file, hash, docIndex, uploadRef.trim())
        if (res.isDuplicate) {
          currentDuplicates.set(file.name, res)
        }
      }
      if (currentDuplicates.size > 0) {
        setBatchDuplicates(currentDuplicates)
        return
      }
    }

    setError(null)
    setSuccess(null)
    activeSectionRef.current = 'batch'
    chunked.reset()

    const metadata: Record<string, string> = {
      companyId: user.companyId,
      documentType: uploadType,
      referenceId: uploadRef.trim(),
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'
    const results: string[] = []
    const smallFiles: typeof batchFiles = []

    // Split into large (chunked) and small files
    for (const file of files) {
      if (file.size >= CHUNKED_UPLOAD_THRESHOLD) {
        setBatchUpload({ busy: true, percent: 0 })

        const fileHash = batchFileHashes.get(file.name)
        const fileMeta: Record<string, string> = {
          ...metadata,
          ...(fileHash ? { contentHash: fileHash } : {}),
        }

        const result = await chunked.start({
          url: `${apiBase}/ipfs/upload/chunked`,
          file,
          metadata: fileMeta,
          sessionKey: sessionKeyFor(file),
        })

        if (!result) {
          setBatchUpload(idle)
          activeSectionRef.current = null
          setError(chunked.error || 'Batch upload cancelled')
          return
        }

        results.push(result.cid)
      } else {
        smallFiles.push(file)
      }
    }

    // Send small files sequentially (not concurrently) to avoid memory spikes
    if (smallFiles.length) {
      setBatchUpload({ busy: true, percent: null })

      for (const file of smallFiles) {
        const fileHash = batchFileHashes.get(file.name)
        const fileMeta: Record<string, string> = {
          ...metadata,
          ...(fileHash ? { contentHash: fileHash } : {}),
        }
        const response = await ipfsService.uploadDocument(file, fileMeta)
        if (!response.success) {
          setBatchUpload(idle)
          activeSectionRef.current = null
          setError(response.error || 'Batch upload failed')
          return
        }
        if (response.data?.cid) results.push(response.data.cid)
      }
    }

    setBatchUpload(idle)
    activeSectionRef.current = null
    setSuccess(`Batch upload completed for ${results.length} file(s).`)
    setBatchFiles([])
    setBatchFileHashes(new Map())
    setBatchDuplicates(new Map())
    setBatchOverride(false)
    if (batchFileInputRef.current) batchFileInputRef.current.value = ''
    await loadDocuments()
  }

  const onBatchUpload = async () => {
    if (!batchFiles.length || !user?.companyId) {
      setError('Select at least one file for batch upload.')
      return
    }

    if (batchDuplicates.size > 0 && !batchOverride) {
      return
    }

    await performBatchUpload(batchFiles, batchOverride)
  }

  const handleBatchUploadOverride = async () => {
    if (!batchFiles.length) return
    setBatchOverride(true)
    await performBatchUpload(batchFiles, true)
  }

  // ---------------------------------------------------------------------------
  // Batch pin
  // ---------------------------------------------------------------------------

  const onBatchPin = async () => {
    const cids = batchPinCids
      .split(/\s|,|\n/)
      .map((cid) => cid.trim())
      .filter(Boolean)

    if (!cids.length) {
      setError('Enter one or more CIDs to pin.')
      return
    }

    setPinBusy(true)
    setError(null)
    setSuccess(null)

    const response = await ipfsService.batchPin(cids)

    setPinBusy(false)

    if (!response.success) {
      setError(response.error || 'Batch pin failed')
      return
    }

    setSuccess(`Batch pin completed for ${response.data?.length || 0} CID(s).`)
  }

  // ---------------------------------------------------------------------------
  // CID retrieval
  // ---------------------------------------------------------------------------

  const onLookupCid = async () => {
    if (!cidLookup.trim()) {
      setError('Enter a CID to retrieve')
      return
    }

    setLookupBusy(true)
    setError(null)
    setCidData(null)
    setCidMetadata(null)

    const [fileResponse, metadataResponse] = await Promise.all([
      ipfsService.getByCid(cidLookup.trim()),
      ipfsService.getMetadata(cidLookup.trim()),
    ])

    setLookupBusy(false)

    if (!fileResponse.success || fileResponse.data?.error) {
      setError(fileResponse.error || fileResponse.data?.error || 'CID retrieval failed')
      return
    }

    setCidData(fileResponse.data)
    setCidMetadata(metadataResponse.data || null)
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  const onDeleteCid = async (cid: string) => {
    setError(null)
    setSuccess(null)

    const response = await ipfsService.deleteByCid(cid)
    if (!response.success) {
      setError(response.error || 'Delete failed')
      return
    }

    setSuccess(`Deleted/unpinned CID ${cid}.`)
    await loadDocuments()
  }

  // ---------------------------------------------------------------------------
  // Certificate anchoring
  // ---------------------------------------------------------------------------

  const onAnchorCertificate = async () => {
    if (!retirementId.trim()) {
      setError('Provide a retirement ID for certificate generation.')
      return
    }

    if (!certificateFile || !user?.companyId) {
      setError('Choose a certificate file to anchor.')
      return
    }

    setError(null)
    setSuccess(null)
    activeSectionRef.current = 'cert'
    chunked.reset()

    if (certificateFile.size >= CHUNKED_UPLOAD_THRESHOLD) {
      setCertUpload({ busy: true, percent: 0 })

      const result = await chunked.start({
        url: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/ipfs/upload/chunked`,
        file: certificateFile,
        metadata: {
          companyId: user.companyId,
          retirementId: retirementId.trim(),
          mimeType: certificateFile.type || 'application/pdf',
          source: 'web-ui',
        },
        sessionKey: sessionKeyFor(certificateFile),
      })

      setCertUpload(idle)
      activeSectionRef.current = null

      if (!result) {
        setError(chunked.error || 'Certificate upload cancelled')
        return
      }

      const cid = result.cid
      setSuccess(`Certificate anchored successfully${cid ? `: ${cid}` : ''}.`)
      await loadDocuments()
      return
    }

    // Small cert — existing path
    setCertUpload({ busy: true, percent: null })

    const response = await ipfsService.anchorCertificate(retirementId.trim(), {
      fileName: certificateFile.name,
      fileSize: certificateFile.size,
      mimeType: certificateFile.type || 'application/pdf',
      companyId: user.companyId,
      metadata: { source: 'web-ui' },
    })

    setCertUpload(idle)
    activeSectionRef.current = null

    if (!response.success) {
      setError(response.error || 'Certificate anchoring failed')
      return
    }

    const cid = (response.data as any)?.cid
    setSuccess(`Certificate anchored successfully${cid ? `: ${cid}` : ''}.`)
    await loadDocuments()
  }

  // ---------------------------------------------------------------------------
  // Certificate verification
  // ---------------------------------------------------------------------------

  const onVerifyCertificate = async () => {
    if (!verifyCid.trim()) {
      setError('Enter a CID for certificate verification.')
      return
    }

    setError(null)
    setVerifyResult(null)

    const response = await ipfsService.verifyCertificate(verifyCid.trim())
    if (!response.success) {
      setError(response.error || 'Verification failed')
      return
    }

    setVerifyResult(response.data)
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const anyBusy = singleUpload.busy || batchUpload.busy || certUpload.busy || pinBusy || lookupBusy

  /** Render a progress bar when percent is known, or a simple spinner bar otherwise. */
  function ProgressBar({ state }: { state: UploadState }) {
    if (!state.busy) return null
    return (
      <div className="mt-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.percent ?? undefined}>
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>{state.percent !== null ? `${state.percent}%` : 'Uploading…'}</span>
          <button
            type="button"
            className="text-red-500 hover:text-red-400 inline-flex items-center gap-1 text-xs"
            onClick={cancelUpload}
            aria-label="Cancel upload"
          >
            <X size={12} /> Cancel
          </button>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all duration-200"
            style={{ width: state.percent !== null ? `${state.percent}%` : '100%' }}
          />
        </div>
      </div>
    )
  }

  // Sync chunked hook progress into the active section
  useEffect(() => {
    if (!chunked.progress) return
    const pct = chunked.progress.percent

    if (activeSectionRef.current === 'single') {
      setSingleUpload((prev) => ({ ...prev, percent: pct }))
    } else if (activeSectionRef.current === 'batch') {
      setBatchUpload((prev) => ({ ...prev, percent: pct }))
    } else if (activeSectionRef.current === 'cert') {
      setCertUpload((prev) => ({ ...prev, percent: pct }))
    }
  }, [chunked.progress])

  return (
    <div className="space-y-6">
      <div className="corporate-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">IPFS Document Manager</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Upload, pin, retrieve, verify, and manage decentralized documents and retirement certificates.
            </p>
          </div>
          <button className="corporate-btn-secondary px-3 py-2 text-sm" type="button" onClick={() => void loadDocuments()}>
            <RefreshCcw size={14} className="mr-2" /> Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Single Upload */}
          <form className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4" onSubmit={onSingleUpload}>
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center"><Upload size={16} className="mr-2" /> Single Upload</h3>
            <input
              ref={singleFileInputRef}
              data-testid="single-file-input"
              type="file"
              onChange={(event) => void handleSingleFileChange(event.target.files?.[0] || null)}
            />
            {singleDuplicate?.isDuplicate && !singleOverride && (
              <div
                role="alert"
                className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{singleDuplicate.message}</span>
                </div>
                <button
                  type="button"
                  className="corporate-btn-secondary px-3 py-1 text-xs font-semibold shrink-0"
                  onClick={() => void handleSingleUploadOverride()}
                >
                  Upload anyway
                </button>
              </div>
            )}
            {uploadFile && uploadFile.size >= CHUNKED_UPLOAD_THRESHOLD && (
              <p className="text-xs text-blue-600 dark:text-blue-400">Large file — resumable chunked upload will be used.</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <select value={uploadType} onChange={(event) => setUploadType(event.target.value as IpfsDocumentType)} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-900">
                {documentTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <input
                value={uploadRef}
                onChange={(event) => setUploadRef(event.target.value)}
                placeholder="referenceId"
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-900"
              />
            </div>
            <button className="corporate-btn-primary px-4 py-2 text-sm" type="submit" disabled={anyBusy || !uploadFile}>Upload</button>
            <ProgressBar state={singleUpload} />
          </form>

          {/* Batch Operations */}
          <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center"><FileUp size={16} className="mr-2" /> Batch Operations</h3>
            <input
              ref={batchFileInputRef}
              data-testid="batch-file-input"
              type="file"
              multiple
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                void handleBatchFilesChange(Array.from(event.target.files || []))
              }
            />
            {batchDuplicates.size > 0 && !batchOverride && (
              <div
                role="alert"
                className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    This file appears to already be uploaded ({Array.from(batchDuplicates.keys()).join(', ')}).
                  </span>
                </div>
                <button
                  type="button"
                  className="corporate-btn-secondary px-3 py-1 text-xs font-semibold shrink-0"
                  onClick={() => void handleBatchUploadOverride()}
                >
                  Upload anyway
                </button>
              </div>
            )}
            <button className="corporate-btn-secondary px-4 py-2 text-sm" type="button" disabled={anyBusy || !batchFiles.length} onClick={() => void onBatchUpload()}>
              Batch Upload {batchFiles.length > 0 ? `(${batchFiles.length})` : ''}
            </button>
            <ProgressBar state={batchUpload} />
            <textarea
              value={batchPinCids}
              onChange={(event) => setBatchPinCids(event.target.value)}
              placeholder="Enter CIDs separated by comma, space, or newline"
              className="w-full min-h-24 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-900"
            />
            <button className="corporate-btn-secondary px-4 py-2 text-sm" type="button" disabled={anyBusy} onClick={() => void onBatchPin()}>
              {pinBusy ? 'Pinning…' : 'Pin CIDs'}
            </button>
          </div>

          {/* CID Retrieval */}
          <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center"><Link2 size={16} className="mr-2" /> CID Retrieval</h3>
            <div className="flex gap-2">
              <input
                value={cidLookup}
                onChange={(event) => setCidLookup(event.target.value)}
                placeholder="Enter CID"
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-900"
              />
              <button className="corporate-btn-secondary px-4 py-2 text-sm" type="button" disabled={lookupBusy} onClick={() => void onLookupCid()}>
                {lookupBusy ? '…' : 'Retrieve'}
              </button>
            </div>
            {cidData && (
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div><strong>CID:</strong> {cidData.cid}</div>
                <div><strong>Content Type:</strong> {cidData.contentType || 'unknown'}</div>
                <div><strong>Data (base64 length):</strong> {cidData.data?.length || 0}</div>
                <div><strong>Gateway:</strong> {cidMetadata?.url || cidData.url}</div>
              </div>
            )}
          </div>

          {/* Certificates */}
          <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center"><ShieldCheck size={16} className="mr-2" /> Certificates</h3>
            <input
              value={retirementId}
              onChange={(event) => setRetirementId(event.target.value)}
              placeholder="Retirement ID"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-900"
            />
            <input type="file" accept="application/pdf" onChange={(event) => setCertificateFile(event.target.files?.[0] || null)} />
            {certificateFile && certificateFile.size >= CHUNKED_UPLOAD_THRESHOLD && (
              <p className="text-xs text-blue-600 dark:text-blue-400">Large file — resumable chunked upload will be used.</p>
            )}
            <button className="corporate-btn-primary px-4 py-2 text-sm" type="button" disabled={anyBusy || !certificateFile} onClick={() => void onAnchorCertificate()}>
              <FileCheck size={14} className="mr-2" /> Generate/Anchor Certificate
            </button>
            <ProgressBar state={certUpload} />

            <div className="flex gap-2">
              <input
                value={verifyCid}
                onChange={(event) => setVerifyCid(event.target.value)}
                placeholder="Certificate CID"
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-900"
              />
              <button className="corporate-btn-secondary px-4 py-2 text-sm" type="button" disabled={anyBusy} onClick={() => void onVerifyCertificate()}>
                Verify
              </button>
            </div>

            {verifyResult && (
              <div className={`rounded-lg px-3 py-2 text-xs ${verifyResult.verified ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'}`}>
                {verifyResult.verified ? (
                  <span className="inline-flex items-center"><CheckCircle2 size={14} className="mr-2" /> Certificate verified on IPFS record.</span>
                ) : (
                  <span className="inline-flex items-center"><AlertCircle size={14} className="mr-2" /> Verification failed: {verifyResult.reason || 'unknown reason'}.</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="corporate-card overflow-hidden">
        <div className="p-6 pb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Document Records</h3>
        </div>
        {loading ? (
          <div className="p-6 text-sm text-gray-600 dark:text-gray-400">Loading documents...</div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-6 text-sm text-gray-600 dark:text-gray-400">No documents found for the current filter/company.</div>
        ) : (
          <div>
            <div ref={tableContainerRef} className="overflow-x-auto max-h-[500px] overflow-y-auto px-6">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-gray-900 z-10">
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Reference</th>
                    <th className="pb-2">File</th>
                    <th className="pb-2">CID</th>
                    <th className="pb-2">Pinned</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {paddingTop > 0 && (
                    <tr>
                      <td colSpan={6} style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} />
                    </tr>
                  )}
                  {rowsToRender.map(({ index, key, doc, measureRef }) => {
                    if (!doc) return null
                    return (
                      <tr
                        key={doc.id || key}
                        data-index={index}
                        ref={measureRef}
                        className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <td className="py-3">{doc.documentType}</td>
                        <td className="py-3">{doc.referenceId}</td>
                        <td className="py-3">{doc.fileName}</td>
                        <td className="py-3 max-w-40 truncate" title={doc.ipfsCid}>{doc.ipfsCid}</td>
                        <td className="py-3">{doc.pinned ? 'Yes' : 'No'}</td>
                        <td className="py-3">
                          <button
                            className="text-red-600 hover:text-red-500 inline-flex items-center"
                            type="button"
                            onClick={() => void onDeleteCid(doc.ipfsCid)}
                          >
                            <Trash2 size={14} className="mr-1" /> Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {paddingBottom > 0 && (
                    <tr>
                      <td colSpan={6} style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={safePage}
              totalPages={totalPages}
              total={filteredDocs.length}
              pageSize={pageSize}
              itemLabel="documents"
              onPageChange={(newPage) => setPage(newPage)}
              onPageSizeChange={(newSize) => {
                setPageSize(newSize)
                setPage(1)
              }}
              showPageSizeSelector
            />
          </div>
        )}
      </div>
    </div>
  )
}
