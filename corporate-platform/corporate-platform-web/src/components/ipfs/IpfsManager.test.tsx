import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IpfsManager from '@/components/ipfs/IpfsManager'
import * as chunkedUploadModule from '@/hooks/useChunkedUpload'

const listDocumentsMock = vi.fn()
const uploadDocumentMock = vi.fn()
const batchUploadMock = vi.fn()
const batchPinMock = vi.fn()
const getByCidMock = vi.fn()
const getMetadataMock = vi.fn()
const deleteByCidMock = vi.fn()
const anchorCertificateMock = vi.fn()
const verifyCertificateMock = vi.fn()

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', companyId: 'company-1' } }),
}))

vi.mock('@/services/ipfs.service', () => ({
  CHUNKED_UPLOAD_THRESHOLD: 10 * 1024 * 1024,
  ipfsService: {
    listDocuments: (...args: unknown[]) => listDocumentsMock(...args),
    uploadDocument: (...args: unknown[]) => uploadDocumentMock(...args),
    batchUpload: (...args: unknown[]) => batchUploadMock(...args),
    batchPin: (...args: unknown[]) => batchPinMock(...args),
    getByCid: (...args: unknown[]) => getByCidMock(...args),
    getMetadata: (...args: unknown[]) => getMetadataMock(...args),
    deleteByCid: (...args: unknown[]) => deleteByCidMock(...args),
    anchorCertificate: (...args: unknown[]) => anchorCertificateMock(...args),
    verifyCertificate: (...args: unknown[]) => verifyCertificateMock(...args),
  },
}))

const docs = [
  {
    id: '1',
    companyId: 'company-1',
    documentType: 'REPORT',
    referenceId: 'ref-1',
    ipfsCid: 'QmDoc1',
    ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
    fileName: 'report.pdf',
    fileSize: 123,
    mimeType: 'application/pdf',
    pinned: true,
    pinnedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

// Default chunked upload hook — acts as a no-op (small files don't use it)
function makeChunkedHook(overrides?: Partial<ReturnType<typeof chunkedUploadModule.useChunkedUpload>>) {
  return {
    progress: null,
    uploading: false,
    error: null,
    start: vi.fn().mockResolvedValue({ cid: 'QmChunked1' }),
    cancel: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  }
}

describe('IpfsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listDocumentsMock.mockResolvedValue({ success: true, data: docs })
    uploadDocumentMock.mockResolvedValue({ success: true, data: { cid: 'QmUpload1' } })
    batchUploadMock.mockResolvedValue({ success: true, data: [] })
    batchPinMock.mockResolvedValue({ success: true, data: [] })
    getByCidMock.mockResolvedValue({ success: true, data: { cid: 'QmDoc1', data: 'abc', contentType: 'application/pdf', url: 'u' } })
    getMetadataMock.mockResolvedValue({ success: true, data: { cid: 'QmDoc1', url: 'u' } })
    deleteByCidMock.mockResolvedValue({ success: true, data: { deleted: true } })
    anchorCertificateMock.mockResolvedValue({ success: true, data: { cid: 'QmCert1' } })
    verifyCertificateMock.mockResolvedValue({ success: true, data: { cid: 'QmCert1', verified: true } })

    vi.spyOn(chunkedUploadModule, 'useChunkedUpload').mockReturnValue(makeChunkedHook())
  })

  it('renders document list from API', async () => {
    render(<IpfsManager />)

    expect(await screen.findByText('report.pdf')).toBeInTheDocument()
    expect(screen.getByText('QmDoc1')).toBeInTheDocument()
  })

  it('shows retrieval result for a CID', async () => {
    render(<IpfsManager />)

    await screen.findByText('report.pdf')

    fireEvent.change(screen.getByPlaceholderText('Enter CID'), {
      target: { value: 'QmDoc1' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Retrieve' }))

    expect(await screen.findByText(/Data \(base64 length\):/)).toBeInTheDocument()
    expect(getByCidMock).toHaveBeenCalledWith('QmDoc1')
    expect(getMetadataMock).toHaveBeenCalledWith('QmDoc1')
  })

  it('verifies certificate CID', async () => {
    render(<IpfsManager />)

    await screen.findByText('report.pdf')

    fireEvent.change(screen.getByPlaceholderText('Certificate CID'), {
      target: { value: 'QmCert1' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Verify' }))

    expect(await screen.findByText('Certificate verified on IPFS record.')).toBeInTheDocument()
    expect(verifyCertificateMock).toHaveBeenCalledWith('QmCert1')
  })

  it('deletes document entry', async () => {
    render(<IpfsManager />)

    await screen.findByText('report.pdf')

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    await waitFor(() => {
      expect(deleteByCidMock).toHaveBeenCalledWith('QmDoc1')
    })
  })

  it('shows fetch error for documents', async () => {
    listDocumentsMock.mockResolvedValue({ success: false, error: 'Unable to load' })

    render(<IpfsManager />)

    expect(await screen.findByText('Unable to load')).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Chunked upload tests
  // ---------------------------------------------------------------------------

  it('uses small-file path (uploadDocument) for files below threshold', async () => {
    render(<IpfsManager />)
    await screen.findByText('report.pdf')

    const smallFile = new File(['small content'], 'small.pdf', { type: 'application/pdf' })
    const input = screen.getAllByRole('button', { name: 'Upload' })[0].closest('form')!
    const fileInput = input.querySelector('input[type="file"]')!

    fireEvent.change(fileInput, { target: { files: [smallFile] } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    await waitFor(() => {
      expect(uploadDocumentMock).toHaveBeenCalledWith(smallFile, expect.objectContaining({ companyId: 'company-1' }))
    })

    expect(chunkedUploadModule.useChunkedUpload().start).not.toHaveBeenCalled()
  })

  it('uses chunked path for files at or above threshold', async () => {
    const startMock = vi.fn().mockResolvedValue({ cid: 'QmChunked1' })
    vi.spyOn(chunkedUploadModule, 'useChunkedUpload').mockReturnValue(makeChunkedHook({ start: startMock }))

    render(<IpfsManager />)
    await screen.findByText('report.pdf')

    // 10 MB + 1 byte — above threshold
    const largeContent = new Uint8Array(10 * 1024 * 1024 + 1)
    const largeFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' })

    const form = screen.getAllByRole('button', { name: 'Upload' })[0].closest('form')!
    const fileInput = form.querySelector('input[type="file"]')!

    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    expect(await screen.findByText(/resumable chunked upload/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    await waitFor(() => {
      expect(startMock).toHaveBeenCalledWith(expect.objectContaining({ file: largeFile }))
    })

    expect(uploadDocumentMock).not.toHaveBeenCalled()
  })

  it('shows error and does not reload docs when chunked upload is cancelled', async () => {
    const cancelMock = vi.fn()
    const startMock = vi.fn().mockResolvedValue(null) // null = cancelled
    vi.spyOn(chunkedUploadModule, 'useChunkedUpload').mockReturnValue(
      makeChunkedHook({ start: startMock, cancel: cancelMock, error: 'Upload cancelled' }),
    )

    render(<IpfsManager />)
    await screen.findByText('report.pdf')

    const largeContent = new Uint8Array(10 * 1024 * 1024 + 1)
    const largeFile = new File([largeContent], 'cancel.pdf', { type: 'application/pdf' })

    const form = screen.getAllByRole('button', { name: 'Upload' })[0].closest('form')!
    const fileInput = form.querySelector('input[type="file"]')!

    fireEvent.change(fileInput, { target: { files: [largeFile] } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    await waitFor(() => {
      expect(screen.getByText('Upload cancelled')).toBeInTheDocument()
    })

    // listDocuments should only have been called once on mount, not again after cancel
    expect(listDocumentsMock).toHaveBeenCalledTimes(1)
  })

  it('resumes from last byte offset when session exists in localStorage', async () => {
    // Simulate a persisted session for the file
    const sessions: Record<string, unknown> = {
      'resume.pdf__10485761__0': {
        sessionKey: 'resume.pdf__10485761__0',
        fileName: 'resume.pdf',
        fileSize: 10 * 1024 * 1024 + 1,
        bytesUploaded: 4 * 1024 * 1024, // 4 MB already done
      },
    }
    localStorage.setItem('ipfs_upload_sessions', JSON.stringify(sessions))

    const startMock = vi.fn().mockResolvedValue({ cid: 'QmResumed' })
    vi.spyOn(chunkedUploadModule, 'useChunkedUpload').mockReturnValue(makeChunkedHook({ start: startMock }))

    render(<IpfsManager />)
    await screen.findByText('report.pdf')

    const largeContent = new Uint8Array(10 * 1024 * 1024 + 1)
    const largeFile = new File([largeContent], 'resume.pdf', { type: 'application/pdf' })
    Object.defineProperty(largeFile, 'lastModified', { value: 0 })

    const form = screen.getAllByRole('button', { name: 'Upload' })[0].closest('form')!
    const fileInput = form.querySelector('input[type="file"]')!

    fireEvent.change(fileInput, { target: { files: [largeFile] } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))

    await waitFor(() => {
      // The sessionKey is derived from file.name + size + lastModified;
      // chunked.start should be called with that key
      expect(startMock).toHaveBeenCalledWith(
        expect.objectContaining({ sessionKey: 'resume.pdf__10485761__0' }),
      )
    })

    expect(await screen.findByText(/QmResumed/)).toBeInTheDocument()

    localStorage.clear()
  })
})
