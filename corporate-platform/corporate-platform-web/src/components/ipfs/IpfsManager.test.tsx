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
})
