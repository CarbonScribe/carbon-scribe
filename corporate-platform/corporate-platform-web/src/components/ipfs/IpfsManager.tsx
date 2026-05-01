'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ipfsService } from '@/services/ipfs.service'
import type { IpfsDocumentRecord, IpfsDocumentType } from '@/types/ipfs'

const documentTypes: IpfsDocumentType[] = [
  'CERTIFICATE',
  'REPORT',
  'AUDIT_LOG',
  'PROOF',
  'UNKNOWN',
]

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })
}

export default function IpfsManager() {
  const { user } = useAuth()

  const [documents, setDocuments] = useState<IpfsDocumentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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

  const filteredDocs = useMemo(() => {
    if (!uploadRef.trim()) return documents
    return documents.filter((doc) => doc.referenceId === uploadRef.trim())
  }, [documents, uploadRef])

  const loadDocuments = async () => {
    setLoading(true)
    setError(null)

    const response = await ipfsService.listDocuments(user?.companyId)
    if (!response.success) {
      setError(response.error || 'Unable to load IPFS documents')
      setDocuments([])
      setLoading(false)
      return
    }

    setDocuments(response.data || [])
    setLoading(false)
  }

  useEffect(() => {
    void loadDocuments()
  }, [user?.companyId])

  const onSingleUpload = async (event: FormEvent) => {
    event.preventDefault()
    if (!uploadFile || !user?.companyId) {
      setError('Choose a file and ensure company context is available.')
      return
    }

    setBusy(true)
    setError(null)
    setSuccess(null)

    const response = await ipfsService.uploadDocument(uploadFile, {
      companyId: user.companyId,
      documentType: uploadType,
      referenceId: uploadRef.trim(),
    })

    if (!response.success || response.data?.error) {
      setError(response.error || response.data?.error || 'Upload failed')
      setBusy(false)
      return
    }

    setSuccess(`Uploaded file to CID ${response.data?.cid}`)
    setUploadFile(null)
    await loadDocuments()
    setBusy(false)
  }

  const onBatchUpload = async () => {
    if (!batchFiles.length || !user?.companyId) {
      setError('Select at least one file for batch upload.')
      return
    }

    setBusy(true)
    setError(null)
    setSuccess(null)

    try {
      const files = await Promise.all(
        batchFiles.map(async (file) => ({
          fileName: file.name,
          content: await fileToBase64(file),
        })),
      )

      const response = await ipfsService.batchUpload({
        files,
        metadata: {
          companyId: user.companyId,
          documentType: uploadType,
          referenceId: uploadRef.trim(),
        },
      })

      if (!response.success) {
        setError(response.error || 'Batch upload failed')
        setBusy(false)
        return
      }

      setSuccess(`Batch upload completed for ${response.data?.length || 0} file(s).`)
      setBatchFiles([])
      await loadDocuments()
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : 'Batch upload failed')
    } finally {
      setBusy(false)
    }
  }

  const onBatchPin = async () => {
    const cids = batchPinCids
      .split(/\s|,|\n/)
      .map((cid) => cid.trim())
      .filter(Boolean)

    if (!cids.length) {
      setError('Enter one or more CIDs to pin.')
      return
    }

    setBusy(true)
    setError(null)
    setSuccess(null)

    const response = await ipfsService.batchPin(cids)
    if (!response.success) {
      setError(response.error || 'Batch pin failed')
      setBusy(false)
      return
    }

    setSuccess(`Batch pin completed for ${response.data?.length || 0} CID(s).`)
    setBusy(false)
  }

  const onLookupCid = async () => {
    if (!cidLookup.trim()) {
      setError('Enter a CID to retrieve')
      return
    }

    setBusy(true)
    setError(null)
    setCidData(null)
    setCidMetadata(null)

    const [fileResponse, metadataResponse] = await Promise.all([
      ipfsService.getByCid(cidLookup.trim()),
      ipfsService.getMetadata(cidLookup.trim()),
    ])

    if (!fileResponse.success || fileResponse.data?.error) {
      setError(fileResponse.error || fileResponse.data?.error || 'CID retrieval failed')
      setBusy(false)
      return
    }

    setCidData(fileResponse.data)
    setCidMetadata(metadataResponse.data || null)
    setBusy(false)
  }

  const onDeleteCid = async (cid: string) => {
    setBusy(true)
    setError(null)
    setSuccess(null)

    const response = await ipfsService.deleteByCid(cid)
    if (!response.success) {
      setError(response.error || 'Delete failed')
      setBusy(false)
      return
    }

    setSuccess(`Deleted/unpinned CID ${cid}.`)
    await loadDocuments()
    setBusy(false)
  }

  const onAnchorCertificate = async () => {
    if (!retirementId.trim()) {
      setError('Provide a retirement ID for certificate generation.')
      return
    }

    if (!certificateFile || !user?.companyId) {
      setError('Choose a certificate file to anchor.')
      return
    }

    setBusy(true)
    setError(null)
    setSuccess(null)

    const content = await fileToBase64(certificateFile)
    const response = await ipfsService.anchorCertificate(retirementId.trim(), {
      content,
      fileName: certificateFile.name,
      fileSize: certificateFile.size,
      mimeType: certificateFile.type || 'application/pdf',
      companyId: user.companyId,
      metadata: { source: 'web-ui' },
    })

    if (!response.success) {
      setError(response.error || 'Certificate anchoring failed')
      setBusy(false)
      return
    }

    const cid = (response.data as any)?.cid
    setSuccess(`Certificate anchored successfully${cid ? `: ${cid}` : ''}.`)
    await loadDocuments()
    setBusy(false)
  }

  const onVerifyCertificate = async () => {
    if (!verifyCid.trim()) {
      setError('Enter a CID for certificate verification.')
      return
    }

    setBusy(true)
    setError(null)
    setVerifyResult(null)

    const response = await ipfsService.verifyCertificate(verifyCid.trim())
    if (!response.success) {
      setError(response.error || 'Verification failed')
      setBusy(false)
      return
    }

    setVerifyResult(response.data)
    setBusy(false)
  }

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
          <form className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4" onSubmit={onSingleUpload}>
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center"><Upload size={16} className="mr-2" /> Single Upload</h3>
            <input type="file" onChange={(event) => setUploadFile(event.target.files?.[0] || null)} />
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
            <button className="corporate-btn-primary px-4 py-2 text-sm" type="submit" disabled={busy || !uploadFile}>Upload</button>
          </form>

          <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center"><FileUp size={16} className="mr-2" /> Batch Operations</h3>
            <input
              type="file"
              multiple
              onChange={(event: ChangeEvent<HTMLInputElement>) => setBatchFiles(Array.from(event.target.files || []))}
            />
            <button className="corporate-btn-secondary px-4 py-2 text-sm" type="button" disabled={busy || !batchFiles.length} onClick={() => void onBatchUpload()}>
              Batch Upload {batchFiles.length > 0 ? `(${batchFiles.length})` : ''}
            </button>
            <textarea
              value={batchPinCids}
              onChange={(event) => setBatchPinCids(event.target.value)}
              placeholder="Enter CIDs separated by comma, space, or newline"
              className="w-full min-h-24 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-900"
            />
            <button className="corporate-btn-secondary px-4 py-2 text-sm" type="button" disabled={busy} onClick={() => void onBatchPin()}>
              Pin CIDs
            </button>
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center"><Link2 size={16} className="mr-2" /> CID Retrieval</h3>
            <div className="flex gap-2">
              <input
                value={cidLookup}
                onChange={(event) => setCidLookup(event.target.value)}
                placeholder="Enter CID"
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-900"
              />
              <button className="corporate-btn-secondary px-4 py-2 text-sm" type="button" onClick={() => void onLookupCid()}>
                Retrieve
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

          <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center"><ShieldCheck size={16} className="mr-2" /> Certificates</h3>
            <input
              value={retirementId}
              onChange={(event) => setRetirementId(event.target.value)}
              placeholder="Retirement ID"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-900"
            />
            <input type="file" accept="application/pdf" onChange={(event) => setCertificateFile(event.target.files?.[0] || null)} />
            <button className="corporate-btn-primary px-4 py-2 text-sm" type="button" disabled={busy || !certificateFile} onClick={() => void onAnchorCertificate()}>
              <FileCheck size={14} className="mr-2" /> Generate/Anchor Certificate
            </button>

            <div className="flex gap-2">
              <input
                value={verifyCid}
                onChange={(event) => setVerifyCid(event.target.value)}
                placeholder="Certificate CID"
                className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-900"
              />
              <button className="corporate-btn-secondary px-4 py-2 text-sm" type="button" disabled={busy} onClick={() => void onVerifyCertificate()}>
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

      <div className="corporate-card p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Document Records</h3>
        {loading ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">Loading documents...</div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">No documents found for the current filter/company.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
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
                {filteredDocs.map((doc) => (
                  <tr key={doc.id}>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
