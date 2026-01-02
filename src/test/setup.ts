import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock environment variables
vi.stubEnv('GOOGLE_API_KEY', 'test-api-key')

// Mock fetch globally
global.fetch = vi.fn()
