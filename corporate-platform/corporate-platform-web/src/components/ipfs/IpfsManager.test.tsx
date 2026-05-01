import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import IpfsManager from '@/components/ipfs/IpfsManager'

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
})
