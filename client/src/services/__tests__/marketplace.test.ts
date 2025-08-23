import { describe, it, expect, beforeEach } from 'vitest'
import { createMockFetch, mockApiResponse, mockApiError } from '@/test/utils'
import * as marketplaceService from '../marketplace'

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  getAuthHeaders: () => ({
    'Authorization': 'Bearer test-token',
    'Content-Type': 'application/json',
    'X-Workspace-ID': 'test-workspace-id',
  }),
}))

describe('Marketplace Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  describe('getMarketplaceStatus', () => {
    it('fetches marketplace status successfully', async () => {
      const mockData = {
        marketplaces: [
          {
            type: 'shopify',
            isConnected: true,
            connectionCount: 2,
            lastSync: '2024-01-01T00:00:00Z',
          },
          {
            type: 'amazon',
            isConnected: false,
            connectionCount: 0,
            lastSync: null,
          },
        ],
      }

      global.fetch = vi.fn().mockResolvedValue(mockApiResponse(mockData))

      const result = await marketplaceService.getMarketplaceStatus()

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/marketplaces/status',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'X-Workspace-ID': 'test-workspace-id',
          }),
        })
      )

      expect(result).toEqual(mockData)
    })

    it('handles API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockApiError('Unauthorized', 401))

      await expect(marketplaceService.getMarketplaceStatus()).rejects.toThrow('Unauthorized')
    })

    it('handles network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      await expect(marketplaceService.getMarketplaceStatus()).rejects.toThrow('Network error')
    })
  })

  describe('testMarketplaceConnection', () => {
    it('tests marketplace connection successfully', async () => {
      const mockCredentials = {
        storeDomain: 'test-store.myshopify.com',
        accessToken: 'test-token',
      }

      const mockResponse = {
        success: true,
        marketplaceType: 'shopify',
        testResult: {
          success: true,
          message: 'Connection successful',
          storeInfo: {
            name: 'Test Store',
            domain: 'test-store.myshopify.com',
          },
        },
      }

      global.fetch = vi.fn().mockResolvedValue(mockApiResponse(mockResponse))

      const result = await marketplaceService.testMarketplaceConnection(
        'shopify',
        mockCredentials
      )

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/marketplaces/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            marketplaceType: 'shopify',
            credentials: mockCredentials,
          }),
        })
      )

      expect(result).toEqual(mockResponse)
    })

    it('handles test failures', async () => {
      const mockCredentials = {
        storeDomain: 'invalid-store.myshopify.com',
        accessToken: 'invalid-token',
      }

      const mockErrorResponse = {
        success: false,
        message: 'Invalid credentials',
        testResult: {
          success: false,
          message: 'Authentication failed',
        },
      }

      global.fetch = vi.fn().mockResolvedValue(mockApiResponse(mockErrorResponse))

      const result = await marketplaceService.testMarketplaceConnection(
        'shopify',
        mockCredentials
      )

      expect(result).toEqual(mockErrorResponse)
    })
  })

  describe('createStoreConnection', () => {
    it('creates store connection successfully', async () => {
      const connectionData = {
        storeName: 'My Test Store',
        marketplaceType: 'shopify' as const,
        credentials: {
          storeDomain: 'test-store.myshopify.com',
          accessToken: 'test-token',
        },
      }

      const mockResponse = {
        _id: 'connection-123',
        ...connectionData,
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      global.fetch = vi.fn().mockResolvedValue(mockApiResponse(mockResponse))

      const result = await marketplaceService.createStoreConnection(connectionData)

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/connections',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(connectionData),
        })
      )

      expect(result).toEqual(mockResponse)
    })

    it('handles validation errors', async () => {
      const invalidData = {
        storeName: '', // Invalid empty name
        marketplaceType: 'shopify' as const,
        credentials: {},
      }

      global.fetch = vi.fn().mockResolvedValue(
        mockApiError('Validation error: storeName is required', 400)
      )

      await expect(
        marketplaceService.createStoreConnection(invalidData)
      ).rejects.toThrow('Validation error: storeName is required')
    })
  })

  describe('getStoreConnections', () => {
    it('fetches store connections successfully', async () => {
      const mockConnections = [
        {
          _id: 'connection-1',
          storeName: 'Store 1',
          marketplaceType: 'shopify',
          isActive: true,
          lastSync: '2024-01-01T00:00:00Z',
        },
        {
          _id: 'connection-2',
          storeName: 'Store 2',
          marketplaceType: 'amazon',
          isActive: true,
          lastSync: null,
        },
      ]

      global.fetch = vi.fn().mockResolvedValue(mockApiResponse(mockConnections))

      const result = await marketplaceService.getStoreConnections()

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/connections',
        expect.objectContaining({
          method: 'GET',
        })
      )

      expect(result).toEqual(mockConnections)
    })

    it('handles empty connections list', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockApiResponse([]))

      const result = await marketplaceService.getStoreConnections()

      expect(result).toEqual([])
    })
  })

  describe('updateStoreConnection', () => {
    it('updates store connection successfully', async () => {
      const connectionId = 'connection-123'
      const updateData = {
        storeName: 'Updated Store Name',
        isActive: false,
      }

      const mockResponse = {
        _id: connectionId,
        ...updateData,
        marketplaceType: 'shopify',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      global.fetch = vi.fn().mockResolvedValue(mockApiResponse(mockResponse))

      const result = await marketplaceService.updateStoreConnection(
        connectionId,
        updateData
      )

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:5000/api/connections/${connectionId}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        })
      )

      expect(result).toEqual(mockResponse)
    })

    it('handles not found errors', async () => {
      const connectionId = 'nonexistent-id'
      const updateData = { storeName: 'Updated Name' }

      global.fetch = vi.fn().mockResolvedValue(
        mockApiError('Connection not found', 404)
      )

      await expect(
        marketplaceService.updateStoreConnection(connectionId, updateData)
      ).rejects.toThrow('Connection not found')
    })
  })

  describe('deleteStoreConnection', () => {
    it('deletes store connection successfully', async () => {
      const connectionId = 'connection-123'

      const mockResponse = {
        message: 'Marketplace connection deleted successfully. 5 products removed.',
        deletedProductsCount: 5,
        productsPreserved: false,
      }

      global.fetch = vi.fn().mockResolvedValue(mockApiResponse(mockResponse))

      const result = await marketplaceService.deleteStoreConnection(
        connectionId,
        true // deleteProducts
      )

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:5000/api/connections/${connectionId}?deleteProducts=true`,
        expect.objectContaining({
          method: 'DELETE',
        })
      )

      expect(result).toEqual(mockResponse)
    })

    it('soft deletes when deleteProducts is false', async () => {
      const connectionId = 'connection-123'

      const mockResponse = {
        message: 'Marketplace connection disconnected successfully',
        deletedProductsCount: 0,
        productsPreserved: true,
      }

      global.fetch = vi.fn().mockResolvedValue(mockApiResponse(mockResponse))

      const result = await marketplaceService.deleteStoreConnection(
        connectionId,
        false // deleteProducts
      )

      expect(global.fetch).toHaveBeenCalledWith(
        `http://localhost:5000/api/connections/${connectionId}?deleteProducts=false`,
        expect.objectContaining({
          method: 'DELETE',
        })
      )

      expect(result).toEqual(mockResponse)
    })
  })
})