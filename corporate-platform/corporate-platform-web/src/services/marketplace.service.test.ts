import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient } from '@/services/api-client'
import { marketplaceService } from '@/services/marketplace.service'
import type { MarketplaceSearchResult, MarketplaceStats, MarketplaceFiltersData, CheckoutOrder } from '@/types/marketplace'

vi.mock('@/services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}))

const mockGet = vi.mocked(apiClient.get)
const mockPost = vi.mocked(apiClient.post)
const mockDelete = vi.mocked(apiClient.delete)

const mockCredit = {
  id: 'credit-1',
  projectId: 'proj-1',
  projectName: 'Amazon Reforestation',
  country: 'Brazil',
  methodology: 'REDD+',
  vintage: 2022,
  availableAmount: 5000,
  totalAmount: 10000,
  pricePerTon: 18.5,
  status: 'available',
  verificationStandard: 'VERRA',
  sdgs: [13, 15],
  dynamicScore: 87,
}

describe('MarketplaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── searchCredits ──────────────────────────────────────────────────────

  describe('searchCredits', () => {
    it('calls GET /marketplace/search with no params when query is empty', async () => {
      const mockResult: MarketplaceSearchResult = {
        data: [mockCredit],
        total: 1,
        page: 1,
        limit: 12,
        facets: {
          countries: [],
          methodologies: [],
          standards: [],
          sdgs: [],
          vintageYears: [],
          priceRange: {},
        },
      }
      mockGet.mockResolvedValue({ success: true, data: mockResult })

      const result = await marketplaceService.searchCredits({ page: 1, limit: 12 })

      expect(mockGet).toHaveBeenCalledWith('/marketplace/search?page=1&limit=12')
      expect(result.success).toBe(true)
      expect(result.data?.data).toHaveLength(1)
      expect(result.data?.total).toBe(1)
    })

    it('appends query string params when filters are provided', async () => {
      mockGet.mockResolvedValue({ success: true, data: { data: [], total: 0, page: 1, limit: 12, facets: {} } })

      await marketplaceService.searchCredits({
        query: 'forest',
        country: 'Brazil',
        methodology: 'REDD+',
        sdgs: [13, 15],
        priceMin: 10,
        priceMax: 50,
        vintageFrom: 2020,
        vintageTo: 2024,
        sortBy: 'price',
        sortOrder: 'asc',
        page: 2,
        limit: 12,
      })

      const calledUrl: string = mockGet.mock.calls[0][0] as string
      expect(calledUrl).toContain('query=forest')
      expect(calledUrl).toContain('country=Brazil')
      expect(calledUrl).toContain('methodology=REDD%2B')
      expect(calledUrl).toContain('sdgs=13')
      expect(calledUrl).toContain('sdgs=15')
      expect(calledUrl).toContain('priceMin=10')
      expect(calledUrl).toContain('priceMax=50')
      expect(calledUrl).toContain('vintageFrom=2020')
      expect(calledUrl).toContain('vintageTo=2024')
      expect(calledUrl).toContain('sortBy=price')
      expect(calledUrl).toContain('sortOrder=asc')
      expect(calledUrl).toContain('page=2')
    })

    it('returns error response on API failure', async () => {
      mockGet.mockResolvedValue({ success: false, error: 'Network error' })

      const result = await marketplaceService.searchCredits({})

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  // ── getCreditById ──────────────────────────────────────────────────────

  describe('getCreditById', () => {
    it('calls GET /credits/:id', async () => {
      mockGet.mockResolvedValue({ success: true, data: mockCredit })

      const result = await marketplaceService.getCreditById('credit-1')

      expect(mockGet).toHaveBeenCalledWith('/credits/credit-1')
      expect(result.data?.id).toBe('credit-1')
    })

    it('encodes special characters in the credit id', async () => {
      mockGet.mockResolvedValue({ success: true, data: mockCredit })

      await marketplaceService.getCreditById('id with spaces')

      expect(mockGet).toHaveBeenCalledWith('/credits/id%20with%20spaces')
    })
  })

  // ── discovery endpoints ────────────────────────────────────────────────

  it('getFeaturedCredits calls GET /marketplace/featured', async () => {
    mockGet.mockResolvedValue({ success: true, data: [mockCredit] })
    await marketplaceService.getFeaturedCredits()
    expect(mockGet).toHaveBeenCalledWith('/marketplace/featured')
  })

  it('getTrendingCredits calls GET /marketplace/trending', async () => {
    mockGet.mockResolvedValue({ success: true, data: [mockCredit] })
    await marketplaceService.getTrendingCredits()
    expect(mockGet).toHaveBeenCalledWith('/marketplace/trending')
  })

  it('getNewestCredits calls GET /marketplace/new', async () => {
    mockGet.mockResolvedValue({ success: true, data: [mockCredit] })
    await marketplaceService.getNewestCredits()
    expect(mockGet).toHaveBeenCalledWith('/marketplace/new')
  })

  it('getSimilarCredits calls GET /marketplace/similar/:id', async () => {
    mockGet.mockResolvedValue({ success: true, data: [mockCredit] })
    await marketplaceService.getSimilarCredits('credit-1')
    expect(mockGet).toHaveBeenCalledWith('/marketplace/similar/credit-1')
  })

  it('getRecommendations appends sdgs param when provided', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] })
    await marketplaceService.getRecommendations([7, 13])
    expect(mockGet).toHaveBeenCalledWith('/marketplace/recommendations?sdgs=7,13')
  })

  it('getRecommendations omits sdgs param when empty', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] })
    await marketplaceService.getRecommendations()
    expect(mockGet).toHaveBeenCalledWith('/marketplace/recommendations')
  })

  // ── stats / filters ────────────────────────────────────────────────────

  it('getStats calls GET /marketplace/stats', async () => {
    const stats: MarketplaceStats = {
      totalCredits: 50000,
      avgPrice: 20,
      projectCount: 30,
      countryCount: 8,
      methodologyCount: 5,
      price: { min: 5, max: 60, median: 18 },
    }
    mockGet.mockResolvedValue({ success: true, data: stats })

    const result = await marketplaceService.getStats()
    expect(mockGet).toHaveBeenCalledWith('/marketplace/stats')
    expect(result.data?.totalCredits).toBe(50000)
  })

  it('getFilters calls GET /marketplace/filters', async () => {
    const filters: MarketplaceFiltersData = {
      methodologies: ['REDD+', 'VCS'],
      countries: ['Brazil', 'Kenya'],
      sdgs: [13, 15],
      vintageRange: { min: 2018, max: 2024 },
      priceRange: { min: 5, max: 80 },
    }
    mockGet.mockResolvedValue({ success: true, data: filters })

    const result = await marketplaceService.getFilters()
    expect(mockGet).toHaveBeenCalledWith('/marketplace/filters')
    expect(result.data?.methodologies).toContain('REDD+')
  })

  // ── cart ───────────────────────────────────────────────────────────────

  describe('cart operations', () => {
    it('addToCartServer posts to /cart/items with creditId and quantity', async () => {
      mockPost.mockResolvedValue({ success: true, data: {} })
      await marketplaceService.addToCartServer('credit-1', 1000)
      expect(mockPost).toHaveBeenCalledWith('/cart/items', { creditId: 'credit-1', quantity: 1000 })
    })

    it('addToCartServer posts without quantity when not provided', async () => {
      mockPost.mockResolvedValue({ success: true, data: {} })
      await marketplaceService.addToCartServer('credit-1')
      expect(mockPost).toHaveBeenCalledWith('/cart/items', { creditId: 'credit-1', quantity: undefined })
    })

    it('removeFromCartServer calls DELETE /cart/items/:itemId', async () => {
      mockDelete.mockResolvedValue({ success: true })
      await marketplaceService.removeFromCartServer('item-99')
      expect(mockDelete).toHaveBeenCalledWith('/cart/items/item-99')
    })

    it('clearCartServer calls DELETE /cart', async () => {
      mockDelete.mockResolvedValue({ success: true })
      await marketplaceService.clearCartServer()
      expect(mockDelete).toHaveBeenCalledWith('/cart')
    })

    it('getServerCart calls GET /cart', async () => {
      mockGet.mockResolvedValue({ success: true, data: { items: [] } })
      await marketplaceService.getServerCart()
      expect(mockGet).toHaveBeenCalledWith('/cart')
    })
  })

  // ── checkout ───────────────────────────────────────────────────────────

  describe('checkout', () => {
    it('calls POST /cart/checkout with payment method', async () => {
      const order: CheckoutOrder = { id: 'order-1', status: 'pending' }
      mockPost.mockResolvedValue({ success: true, data: order })

      const result = await marketplaceService.checkout({ paymentMethod: 'credit_card' })

      expect(mockPost).toHaveBeenCalledWith('/cart/checkout', { paymentMethod: 'credit_card' })
      expect(result.data?.id).toBe('order-1')
    })

    it('confirmPurchase calls POST /checkout/confirm with orderId', async () => {
      const order: CheckoutOrder = { id: 'order-1', status: 'completed' }
      mockPost.mockResolvedValue({ success: true, data: order })

      const result = await marketplaceService.confirmPurchase({ orderId: 'order-1' })

      expect(mockPost).toHaveBeenCalledWith('/checkout/confirm', { orderId: 'order-1' })
      expect(result.data?.status).toBe('completed')
    })

    it('returns error when checkout fails', async () => {
      mockPost.mockResolvedValue({ success: false, error: 'Insufficient credit balance' })

      const result = await marketplaceService.checkout({ paymentMethod: 'wire' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Insufficient credit balance')
    })
  })
})
