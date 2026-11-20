import { webcrypto } from 'node:crypto'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  useAuth: () => ({ user: { id: 'u1', companyId: 'company-1', role: 'admin' } }),
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

    if (!window.crypto?.subtle) {
      Object.defineProperty(window, 'crypto', {
        value: webcrypto,
        writable: true,
        configurable: true,
      })
    }
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

    // Confirmation dialog must appear
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    // File name and CID appear inside the dialog
    expect(within(dialog).getByText('report.pdf')).toBeInTheDocument()
    expect(within(dialog).getByText('QmDoc1')).toBeInTheDocument()

    // Confirm deletion
    fireEvent.click(screen.getByRole('button', { name: /delete permanently/i }))

    await waitFor(() => {
      expect(deleteByCidMock).toHaveBeenCalledWith('QmDoc1')
    })

    // Dialog should close after confirmation
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows fetch error for documents', async () => {
    listDocumentsMock.mockResolvedValue({ success: false, error: 'Unable to load' })

    render(<IpfsManager />)

    expect(await screen.findByText('Unable to load')).toBeInTheDocument()
  })

  it('supports paging through multiple pages of documents', async () => {
    const manyDocs = Array.from({ length: 25 }, (_, i) => ({
      id: `doc-${i + 1}`,
      companyId: 'company-1',
      documentType: 'REPORT',
      referenceId: `ref-${i + 1}`,
      ipfsCid: `QmDoc${i + 1}`,
      ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
      fileName: `report-${i + 1}.pdf`,
      fileSize: 100 + i,
      mimeType: 'application/pdf',
      pinned: true,
      pinnedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    }))

    listDocumentsMock.mockResolvedValue({ success: true, data: manyDocs })

    render(<IpfsManager />)

    expect(await screen.findByText('report-1.pdf')).toBeInTheDocument()
    expect(screen.getByText('report-10.pdf')).toBeInTheDocument()
    expect(screen.queryByText('report-11.pdf')).not.toBeInTheDocument()

    // Showing 1 to 10 of 25 documents
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()

    // Click Next page
    const nextBtn = screen.getByRole('button', { name: /next page/i })
    fireEvent.click(nextBtn)

    expect(await screen.findByText('report-11.pdf')).toBeInTheDocument()
    expect(screen.getByText('report-20.pdf')).toBeInTheDocument()
    expect(screen.queryByText('report-1.pdf')).not.toBeInTheDocument()
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument()

    // Click Previous page
    const prevBtn = screen.getByRole('button', { name: /previous page/i })
    fireEvent.click(prevBtn)

    expect(await screen.findByText('report-1.pdf')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument()
  })

  it('filters by uploadRef without regression and resets page', async () => {
    const mixedDocs = [
      {
        id: '1',
        companyId: 'company-1',
        documentType: 'REPORT',
        referenceId: 'target-ref',
        ipfsCid: 'QmDoc1',
        fileName: 'target.pdf',
        fileSize: 100,
        mimeType: 'application/pdf',
        pinned: true,
      },
      {
        id: '2',
        companyId: 'company-1',
        documentType: 'REPORT',
        referenceId: 'other-ref',
        ipfsCid: 'QmDoc2',
        fileName: 'other.pdf',
        fileSize: 200,
        mimeType: 'application/pdf',
        pinned: true,
      },
    ]

    listDocumentsMock.mockResolvedValue({ success: true, data: mixedDocs })

    render(<IpfsManager />)

    expect(await screen.findByText('target.pdf')).toBeInTheDocument()
    expect(screen.getByText('other.pdf')).toBeInTheDocument()

    // Type into referenceId input in the single upload form
    const refInput = screen.getByPlaceholderText('referenceId')
    fireEvent.change(refInput, { target: { value: 'target-ref' } })

    expect(screen.getByText('target.pdf')).toBeInTheDocument()
    expect(screen.queryByText('other.pdf')).not.toBeInTheDocument()
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Showing 1 to 1 of 1 documents')
  })

  it('renders and paginates large document sets', async () => {
    const largeDocSet = Array.from({ length: 100 }, (_, i) => ({
      id: `doc-${i + 1}`,
      companyId: 'company-1',
      documentType: 'REPORT',
      referenceId: `ref-${i + 1}`,
      ipfsCid: `QmDoc${i + 1}`,
      fileName: `doc-${i + 1}.pdf`,
      fileSize: 100,
      mimeType: 'application/pdf',
      pinned: true,
    }))

    listDocumentsMock.mockResolvedValue({ success: true, data: largeDocSet })

    render(<IpfsManager />)

    expect(await screen.findByText('doc-1.pdf')).toBeInTheDocument()
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Showing 1 to 10 of 100 documents')

    // Change page size to 20
    const pageSizeSelect = screen.getByLabelText(/select rows per page for documents/i)
    fireEvent.change(pageSizeSelect, { target: { value: '20' } })

    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Showing 1 to 20 of 100 documents')
  })

  it('detects identical filename before upload starts and allows override', async () => {
    render(<IpfsManager />)
    await screen.findByText('report.pdf')

    const file = new File(['dummy file content'], 'report.pdf', { type: 'application/pdf' })
    const fileInput = screen.getByTestId('single-file-input')

    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(await screen.findByText(/This file appears to already be uploaded/i)).toBeInTheDocument()
    expect(uploadDocumentMock).not.toHaveBeenCalled()

    const overrideButton = screen.getByRole('button', { name: /upload anyway/i })
    expect(overrideButton).toBeInTheDocument()

    fireEvent.click(overrideButton)

    await waitFor(() => {
      expect(uploadDocumentMock).toHaveBeenCalled()
    })
    expect(await screen.findByText(/Uploaded file to CID QmUpload1/i)).toBeInTheDocument()
  })

  it('detects identical content hash before upload starts and allows override', async () => {
    const hashDoc = {
      id: 'hash-doc-1',
      companyId: 'company-1',
      documentType: 'REPORT',
      referenceId: 'ref-hash',
      ipfsCid: 'QmHashDoc1',
      fileName: 'existing-hash-doc.pdf',
      fileSize: 5,
      mimeType: 'text/plain',
      pinned: true,
      contentHash: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    }

    listDocumentsMock.mockResolvedValue({ success: true, data: [hashDoc] })

    render(<IpfsManager />)
    await screen.findByText('existing-hash-doc.pdf')

    const file = new File(['hello'], 'renamed-file-with-different-name.pdf', { type: 'text/plain' })
    const fileInput = screen.getByTestId('single-file-input')

    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(await screen.findByText(/This file appears to already be uploaded/i)).toBeInTheDocument()
    expect(screen.getByText(/identical content hash matching "existing-hash-doc.pdf"/i)).toBeInTheDocument()
    expect(uploadDocumentMock).not.toHaveBeenCalled()

    const overrideButton = screen.getByRole('button', { name: /upload anyway/i })
    fireEvent.click(overrideButton)

    await waitFor(() => {
      expect(uploadDocumentMock).toHaveBeenCalled()
    })
    expect(await screen.findByText(/Uploaded file to CID QmUpload1/i)).toBeInTheDocument()
  })

  it('uploads genuinely new file without duplicate warning', async () => {
    render(<IpfsManager />)
    await screen.findByText('report.pdf')

    const file = new File(['completely unique content'], 'brand-new-report.pdf', { type: 'application/pdf' })
    const fileInput = screen.getByTestId('single-file-input')

    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(screen.queryByText(/This file appears to already be uploaded/i)).not.toBeInTheDocument()

    const uploadButton = screen.getByRole('button', { name: /^Upload$/i })
    fireEvent.click(uploadButton)

    await waitFor(() => {
      expect(uploadDocumentMock).toHaveBeenCalled()
    })
    expect(await screen.findByText(/Uploaded file to CID QmUpload1/i)).toBeInTheDocument()
  })

  it('detects duplicates in batch upload and allows override', async () => {
    render(<IpfsManager />)
    await screen.findByText('report.pdf')

    const batchInput = screen.getByTestId('batch-file-input')
    const files = [
      new File(['foo'], 'report.pdf', { type: 'application/pdf' }),
      new File(['bar'], 'new-file.pdf', { type: 'application/pdf' }),
    ]

    fireEvent.change(batchInput, { target: { files } })

    expect(await screen.findByText(/This file appears to already be uploaded/i)).toBeInTheDocument()
    expect(uploadDocumentMock).not.toHaveBeenCalled()

    const overrideButton = screen.getByRole('button', { name: /upload anyway/i })
    fireEvent.click(overrideButton)

    await waitFor(() => {
      expect(uploadDocumentMock).toHaveBeenCalled()
    })
    expect(await screen.findByText(/Batch upload completed for 2 file\(s\)\./i)).toBeInTheDocument()
  })

  // ---------------------------------------------------------------------------
  // Deletion safeguards (#806)
  // ---------------------------------------------------------------------------

  it('shows confirmation dialog before deleting — cancel does nothing', async () => {
    render(<IpfsManager />)
    await screen.findByText('report.pdf')

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    // Dialog appears with document details
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('QmDoc1')).toBeInTheDocument()

    // Cancel — service must NOT be called
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleteByCidMock).not.toHaveBeenCalled()
  })

  it('shows file name, CID, type and linked reference in the dialog', async () => {
    render(<IpfsManager />)
    await screen.findByText('report.pdf')

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('report.pdf')).toBeInTheDocument()
    expect(within(dialog).getByText('QmDoc1')).toBeInTheDocument()
    expect(within(dialog).getByText('REPORT')).toBeInTheDocument()
    expect(within(dialog).getByText('ref-1')).toBeInTheDocument()
  })

  it('requires typed confirmation for CERTIFICATE documents', async () => {
    const certDoc = {
      id: 'cert-1',
      companyId: 'company-1',
      documentType: 'CERTIFICATE',
      referenceId: 'retirement-42',
      ipfsCid: 'QmCertABCDEF',
      ipfsGateway: 'https://gateway.pinata.cloud/ipfs/',
      fileName: 'cert.pdf',
      fileSize: 500,
      mimeType: 'application/pdf',
      pinned: true,
      pinnedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    listDocumentsMock.mockResolvedValue({ success: true, data: [certDoc] })

    render(<IpfsManager />)
    await screen.findByText('cert.pdf')

    fireEvent.click(screen.getByRole('button', { name: /delete cert\.pdf/i }))

    await screen.findByRole('dialog')

    // Confirm button disabled before typing
    const confirmBtn = screen.getByRole('button', { name: /delete permanently/i })
    expect(confirmBtn).toBeDisabled()

    // Type wrong token — still disabled
    const input = screen.getByRole('textbox', { name: /type confirmation token/i })
    fireEvent.change(input, { target: { value: 'WRONG1' } })
    expect(confirmBtn).toBeDisabled()

    // Type correct last-6 token — button enabled
    fireEvent.change(input, { target: { value: 'BCDEF' } })
    // last 6 of 'QmCertABCDEF' is 'BCDEF' — wait, let's use actual value
    const token = 'QmCertABCDEF'.slice(-6) // 'BCDEF' — length is 6 ✓ ('ABCDEF' — recheck)
    fireEvent.change(input, { target: { value: token } })
    expect(confirmBtn).not.toBeDisabled()

    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(deleteByCidMock).toHaveBeenCalledWith('QmCertABCDEF')
    })
  })

  it('disables the delete button while deletion is in flight (no double-submit)', async () => {
    let resolveDelete!: (val: unknown) => void
    deleteByCidMock.mockReturnValue(new Promise((res) => { resolveDelete = res }))

    render(<IpfsManager />)
    await screen.findByText('report.pdf')

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: /delete permanently/i }))

    // While in-flight the confirm button shows a spinner and is disabled
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deleting/i })).toBeDisabled()
    })

    // Resolve the request
    resolveDelete({ success: true, data: { deleted: true } })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('shows recovery guidance in the success message', async () => {
    render(<IpfsManager />)
    await screen.findByText('report.pdf')

    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: /delete permanently/i }))

    expect(await screen.findByText(/Deleted\/unpinned CID QmDoc1/i)).toBeInTheDocument()
    // Recovery guidance text — CIDs starting with Qm are content-addressed
    expect(screen.getByText(/re-pin it at any time/i)).toBeInTheDocument()
  })

  it('hides the delete button for viewer role', async () => {
    // Re-mock useAuth for this test to return a viewer role
    const authMod = await import('@/contexts/AuthContext')
    const original = authMod.useAuth
    vi.spyOn(authMod, 'useAuth').mockReturnValue({
      user: { id: 'v1', companyId: 'company-1', role: 'viewer', email: '', firstName: '', lastName: '' },
      role: null,
      permissions: [],
      isLoading: false,
      isAuthenticated: true,
      sessionExpiryState: 'active',
      secondsUntilExpiry: 3600,
      hasRole: () => false,
      hasAnyRole: () => false,
      hasPermission: () => false,
      canAccessRoute: () => ({ allowed: true }),
      login: async () => {},
      register: async () => {},
      logout: async () => {},
      refreshToken: async () => false,
      renewSession: async () => false,
    })

    render(<IpfsManager />)
    await screen.findByText('report.pdf')

    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()

    vi.spyOn(authMod, 'useAuth').mockRestore()
    // suppress unused var warning
    void original
  })
})

