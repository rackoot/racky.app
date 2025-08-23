import { describe, it, expect, beforeEach } from 'vitest'
import { mockApiResponse, mockApiError } from '@/test/utils'
import { marketplaceService } from '../marketplace'

// Mock localStorage for auth tokens
beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn()
  
  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn().mockImplementation((key) => {
        if (key === 'token') return 'test-token'
        if (key === 'currentWorkspaceId') return 'test-workspace-id'
        return null
      }),
    },
    writable: true
  })
})

describe('Marketplace Service', () => {

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
        '/api/marketplaces/status',
        expect.objectContaining({
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

  describe('testConnection', () => {
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

      const result = await marketplaceService.testConnection(
        'shopify',
        mockCredentials
      )

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/marketplaces/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({
            type: 'shopify',
            credentials: mockCredentials,
          }),
        })
      )

      expect(result).toEqual({
        success: true,
        data: mockResponse
      })
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

      const result = await marketplaceService.testConnection(
        'shopify',
        mockCredentials
      )

      expect(result).toEqual(mockErrorResponse)
    })
  })

  describe('createStoreWithMarketplace', () => {
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

      const result = await marketplaceService.createStoreWithMarketplace(connectionData)

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/marketplaces/create-store',
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
        marketplaceService.createStoreWithMarketplace(invalidData)
      ).rejects.toThrow('Validation error: storeName is required')
    })
  })

  describe('getMarketplaces', () => {
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

      const result = await marketplaceService.getMarketplaces()

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/marketplaces',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      )

      expect(result).toEqual(mockConnections)
    })

    it('handles empty connections list', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockApiResponse([]))

      const result = await marketplaceService.getMarketplaces()

      expect(result).toEqual([])
    })
  })

  describe('testExistingConnection', () => {
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

      const result = await marketplaceService.testExistingConnection(
        connectionId
      )

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/connections/${connectionId}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        })
      )

      expect(result).toEqual(mockResponse)
    })

    it('handles not found errors', async () => {
      const connectionId = 'nonexistent-id'

      global.fetch = vi.fn().mockResolvedValue(
        mockApiError('Connection not found', 404)
      )

      await expect(
        marketplaceService.testExistingConnection(connectionId)
      ).rejects.toThrow('Connection not found')
    })
  })

  describe('disconnectMarketplace', () => {
    it('deletes store connection successfully', async () => {
      const connectionId = 'connection-123'

      const mockResponse = {
        message: 'Marketplace connection deleted successfully. 5 products removed.',
        deletedProductsCount: 5,
        productsPreserved: false,
      }

      global.fetch = vi.fn().mockResolvedValue(mockApiResponse(mockResponse))

      const result = await marketplaceService.disconnectMarketplace(
        connectionId,
        true // deleteProducts
      )

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/connections/${connectionId}?deleteProducts=true`,
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

      const result = await marketplaceService.disconnectMarketplace(
        connectionId,
        false // deleteProducts
      )

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/connections/${connectionId}?deleteProducts=false`,
        expect.objectContaining({
          method: 'DELETE',
        })
      )

      expect(result).toEqual(mockResponse)
    })
  })
})