// Mock ora to avoid spinner-related open handles in tests
jest.mock('ora', () => {
  const mockSpinner = {
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
  }
  return jest.fn(() => mockSpinner)
})

// Increase timeout for git operations
jest.setTimeout(30000)
