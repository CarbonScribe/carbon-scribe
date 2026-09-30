import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// Clear all mocks after each test to prevent state leakage
afterEach(() => {
  vi.clearAllMocks()
})

// Mock Next.js router
const mockUsePathname = vi.fn(() => '/team')

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: mockUsePathname,
}))

// Export mocked usePathname for route-specific test overrides
export const mockedUsePathname = mockUsePathname

// Mock Next.js image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => {
    // Return a simple mock implementation
    return {
      props: { src, alt, ...props },
    }
  },
}))

// Mock API client - each method is a fresh vi.fn() that can be overridden per test
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPut = vi.fn()
const mockDelete = vi.fn()
const mockPatch = vi.fn()
const mockRequest = vi.fn()

vi.mock('@/lib/api/apiClient', () => ({
  default: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
    delete: mockDelete,
    patch: mockPatch,
    request: mockRequest,
  },
}))

// Export mocked functions for easier test manipulation
export const mockedApiClient = {
  get: mockGet,
  post: mockPost,
  put: mockPut,
  delete: mockDelete,
  patch: mockPatch,
  request: mockRequest,
}

// Global test setup — only applies in browser-like environments (jsdom)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // Mock ResizeObserver
  global.ResizeObserver = class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  } as any

  // Mock IntersectionObserver
  global.IntersectionObserver = class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
    takeRecords = vi.fn()
    root = null
    rootMargin = ''
    thresholds = []
  } as any

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  }
  global.localStorage = localStorageMock as any
}
