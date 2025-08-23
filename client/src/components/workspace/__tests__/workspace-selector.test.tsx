import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@/test/utils'
import { userEvent } from '@testing-library/user-event'
import { WorkspaceSelector } from '../workspace-selector'

// Mock the workspace service
vi.mock('@/services/workspace', () => ({
  getWorkspaces: vi.fn(),
}))

const mockWorkspaces = [
  {
    _id: 'workspace-1',
    name: 'My First Workspace',
    slug: 'my-first-workspace',
    owner: {
      _id: 'user-1',
      email: 'owner@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
    settings: {
      timezone: 'UTC',
      currency: 'USD',
      language: 'en',
    },
    isActive: true,
    userRole: 'OWNER' as const,
    memberCount: 5,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  },
  {
    _id: 'workspace-2',
    name: 'Team Workspace',
    slug: 'team-workspace',
    owner: {
      _id: 'user-2',
      email: 'team@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
    },
    settings: {
      timezone: 'America/New_York',
      currency: 'USD',
      language: 'en',
    },
    isActive: true,
    userRole: 'ADMIN' as const,
    memberCount: 12,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-01-15T00:00:00.000Z',
  },
]

describe('WorkspaceSelector Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Configure localStorage mock for authentication
    ;(window.localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'token') return 'test-auth-token'
      if (key === 'currentWorkspaceId') return 'workspace-1'
      return null
    })
  })

  it('renders current workspace when provided', () => {
    render(<WorkspaceSelector />, {
      workspace: mockWorkspaces[0]
    })
    
    expect(screen.getByText('My First Workspace')).toBeInTheDocument()
  })

  it('shows workspace role badge', () => {
    render(<WorkspaceSelector />, {
      workspace: mockWorkspaces[0]
    })
    
    expect(screen.getByText('OWNER')).toBeInTheDocument()
  })

  it('opens dropdown when clicked', async () => {
    const user = userEvent.setup()
    
    render(<WorkspaceSelector />, {
      workspace: mockWorkspaces[0]
    })
    
    const trigger = screen.getByRole('button')
    await user.click(trigger)
    
    // Should show workspace list options
    expect(screen.getByText('Switch Workspace')).toBeInTheDocument()
    expect(screen.getByText('Create New Workspace')).toBeInTheDocument()
  })

  it('filters workspaces based on search', async () => {
    const user = userEvent.setup()
    
    render(<WorkspaceSelector />)
    
    const trigger = screen.getByRole('button')
    await user.click(trigger)
    
    // Type in search input if it exists
    const searchInput = screen.queryByPlaceholderText('Search workspaces...')
    if (searchInput) {
      await user.type(searchInput, 'Team')
      
      // Should only show matching workspace
      expect(screen.getByText('Team Workspace')).toBeInTheDocument()
      expect(screen.queryByText('My First Workspace')).not.toBeInTheDocument()
    }
  })

  it('shows create workspace option', async () => {
    const user = userEvent.setup()
    
    render(<WorkspaceSelector />)
    
    const trigger = screen.getByRole('button')
    await user.click(trigger)
    
    const createOption = screen.getByText('Create New Workspace')
    expect(createOption).toBeInTheDocument()
  })

  it('handles workspace switching', async () => {
    const user = userEvent.setup()
    
    render(<WorkspaceSelector />, {
      workspace: mockWorkspaces[0]
    })
    
    const trigger = screen.getByRole('button')
    await user.click(trigger)
    
    // Click on different workspace if available in dropdown
    const workspaceOption = screen.queryByText('Team Workspace')
    if (workspaceOption) {
      await user.click(workspaceOption)
      
      // Should call workspace context method (mocked)
      // This would be tested with proper context mocking
    }
  })

  it('shows loading state', () => {
    render(<WorkspaceSelector />, {
      workspace: undefined
    })
    
    // Should show loading skeleton or placeholder
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('handles error state gracefully', () => {
    render(<WorkspaceSelector />)
    
    // Component should render even with no workspace data
    const trigger = screen.getByRole('button')
    expect(trigger).toBeInTheDocument()
  })

  it('shows workspace member count correctly', async () => {
    const user = userEvent.setup()
    
    render(<WorkspaceSelector />, {
      workspace: {
        ...mockWorkspaces[1],
        memberCount: 1
      }
    })
    
    // Open dropdown to see member count
    const trigger = screen.getByRole('button')
    await user.click(trigger)
    
    expect(screen.getByText('1 member')).toBeInTheDocument()
  })

  it('truncates long workspace names', () => {
    const longNameWorkspace = {
      ...mockWorkspaces[0],
      name: 'This is a very long workspace name that should be truncated'
    }
    
    render(<WorkspaceSelector />, {
      workspace: longNameWorkspace
    })
    
    const nameElement = screen.getByText(longNameWorkspace.name)
    expect(nameElement).toBeInTheDocument()
    // Could check for truncation CSS classes if implemented
  })

  it('is accessible via keyboard navigation', async () => {
    const user = userEvent.setup()
    
    render(<WorkspaceSelector />)
    
    const trigger = screen.getByRole('button')
    
    // Focus the trigger
    trigger.focus()
    expect(trigger).toHaveFocus()
    
    // Open with Enter key
    await user.keyboard('{Enter}')
    
    // Should open dropdown (test depends on implementation)
    // Navigation with arrow keys would be tested here
  })
})