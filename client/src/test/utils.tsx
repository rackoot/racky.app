import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { WorkspaceProvider } from '@/components/workspace/workspace-context'

// Mock workspace context data
const mockWorkspaceContextValue = {
  currentWorkspace: {
    _id: 'test-workspace-id',
    name: 'Test Workspace',
    slug: 'test-workspace',
    owner: {
      _id: 'test-user-id',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
    },
    settings: {
      timezone: 'UTC',
      currency: 'USD',
      language: 'en',
    },
    isActive: true,
    userRole: 'OWNER' as const,
    memberCount: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  workspaces: [],
  setCurrentWorkspace: () => {},
  refreshWorkspaces: async () => {},
  isLoading: false,
  hasWorkspaceAccess: (permission: string) => true,
}

// Mock user context data
const mockUser = {
  _id: 'test-user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'USER' as const,
}

// Create a custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[]
  user?: typeof mockUser
  workspace?: typeof mockWorkspaceContextValue.currentWorkspace
}

const AllTheProviders = ({ 
  children, 
  initialEntries = ['/'],
  workspace = mockWorkspaceContextValue.currentWorkspace 
}: { 
  children: React.ReactNode
  initialEntries?: string[]
  workspace?: typeof mockWorkspaceContextValue.currentWorkspace
}) => {
  return (
    <BrowserRouter>
      <WorkspaceProvider value={{
        ...mockWorkspaceContextValue,
        currentWorkspace: workspace,
      }}>
        {children}
      </WorkspaceProvider>
    </BrowserRouter>
  )
}

const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { initialEntries, user, workspace, ...renderOptions } = options
  
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllTheProviders 
      initialEntries={initialEntries} 
      workspace={workspace}
    >
      {children}
    </AllTheProviders>
  )
  
  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

// Mock API responses
export const mockApiResponse = (data: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  json: async () => ({ success: true, data }),
  text: async () => JSON.stringify({ success: true, data }),
  headers: new Headers(),
})

export const mockApiError = (message: string, status = 400) => ({
  ok: false,
  status,
  statusText: 'Error',
  json: async () => ({ success: false, message }),
  text: async () => JSON.stringify({ success: false, message }),
  headers: new Headers(),
})

// Create mock functions for common API calls
export const createMockFetch = (responses: Record<string, any>) => {
  return vi.fn().mockImplementation((url: string) => {
    const endpoint = url.replace('http://localhost:5000/api', '')
    if (responses[endpoint]) {
      return Promise.resolve(mockApiResponse(responses[endpoint]))
    }
    return Promise.resolve(mockApiError('Not found', 404))
  })
}

// Helper to wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Export everything from testing-library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'

// Override render method
export { customRender as render }

// Export mocks
export { mockUser, mockWorkspaceContextValue }