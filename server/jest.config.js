module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup/jest.setup.ts'],
  testTimeout: 30000,
  moduleNameMapper: {
    '^@/common/(.*)$': '<rootDir>/src/common/$1',
    '^@/auth/(.*)$': '<rootDir>/src/modules/auth/$1',
    '^@/admin/(.*)$': '<rootDir>/src/modules/admin/$1',
    '^@/dashboard/(.*)$': '<rootDir>/src/modules/dashboard/$1',
    '^@/demo/(.*)$': '<rootDir>/src/modules/demo/$1',
    '^@/marketplaces/(.*)$': '<rootDir>/src/modules/marketplaces/$1',
    '^@/notifications/(.*)$': '<rootDir>/src/modules/notifications/$1',
    '^@/opportunities/(.*)$': '<rootDir>/src/modules/opportunities/$1',
    '^@/products/(.*)$': '<rootDir>/src/modules/products/$1',
    '^@/stores/(.*)$': '<rootDir>/src/modules/stores/$1',
    '^@/subscriptions/(.*)$': '<rootDir>/src/modules/subscriptions/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  // Ignore certain patterns to speed up tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
  // Handle ES modules properly
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};