import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

interface Workspace {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  userRole: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
  memberCount?: number;
  subscription?: {
    status: string;
    plan: string;
    endsAt?: Date;
  };
  settings: {
    timezone: string;
    currency: string;
    language: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
  error: string | null;
  setCurrentWorkspace: (workspace: Workspace) => void;
  refreshWorkspaces: () => Promise<void>;
  createWorkspace: (data: CreateWorkspaceData) => Promise<Workspace>;
  updateWorkspace: (workspaceId: string, data: UpdateWorkspaceData) => Promise<Workspace>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
}

interface CreateWorkspaceData {
  name: string;
  description?: string;
  settings?: {
    timezone?: string;
    currency?: string;
    language?: string;
  };
}

interface UpdateWorkspaceData {
  name?: string;
  description?: string;
  settings?: {
    timezone?: string;
    currency?: string;
    language?: string;
  };
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load workspaces from API
  const refreshWorkspaces = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        return;
      }
      
      const response = await fetch('/api/workspaces', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to load workspaces`);
      }

      const data = await response.json();
      if (data.success) {
        setWorkspaces(data.data);
      } else {
        throw new Error(data.message || 'Failed to load workspaces');
      }
    } catch (err) {
      console.error('Error loading workspaces:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  };

  // Create new workspace
  const createWorkspace = async (data: CreateWorkspaceData): Promise<Workspace> => {
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create workspace');
      }

      const result = await response.json();
      if (result.success) {
        await refreshWorkspaces();
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to create workspace');
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create workspace');
    }
  };

  // Update workspace
  const updateWorkspace = async (workspaceId: string, data: UpdateWorkspaceData): Promise<Workspace> => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
          'X-Workspace-ID': workspaceId,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update workspace');
      }

      const result = await response.json();
      if (result.success) {
        await refreshWorkspaces();
        
        // Update current workspace if it's the one being updated
        if (currentWorkspace && currentWorkspace._id === workspaceId) {
          setCurrentWorkspace(result.data);
        }
        
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to update workspace');
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update workspace');
    }
  };

  // Delete workspace
  const deleteWorkspace = async (workspaceId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
          'X-Workspace-ID': workspaceId,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete workspace');
      }

      const result = await response.json();
      if (result.success) {
        await refreshWorkspaces();
        
        // If the deleted workspace was current, switch to another
        if (currentWorkspace && currentWorkspace._id === workspaceId) {
          const remainingWorkspaces = workspaces.filter(w => w._id !== workspaceId);
          if (remainingWorkspaces.length > 0) {
            setCurrentWorkspace(remainingWorkspaces[0]);
            localStorage.setItem('currentWorkspaceId', remainingWorkspaces[0]._id);
          } else {
            setCurrentWorkspace(null);
            localStorage.removeItem('currentWorkspaceId');
          }
        }
      } else {
        throw new Error(result.message || 'Failed to delete workspace');
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete workspace');
    }
  };

  // Set current workspace and persist to localStorage
  const handleSetCurrentWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem('currentWorkspaceId', workspace._id);
  };

  // Load initial data and restore current workspace from localStorage
  useEffect(() => {
    const loadInitialData = async () => {
      // Only try to load workspaces if we have a token
      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoading(false);
        setWorkspaces([]);
        setCurrentWorkspace(null);
        return;
      }

      await refreshWorkspaces();
    };

    loadInitialData();

    // Also listen for storage events to detect login/logout from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        loadInitialData();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Restore current workspace from localStorage when workspaces are loaded
  useEffect(() => {
    if (workspaces.length > 0 && !currentWorkspace) {
      const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
      if (savedWorkspaceId) {
        const savedWorkspace = workspaces.find(w => w._id === savedWorkspaceId);
        if (savedWorkspace) {
          setCurrentWorkspace(savedWorkspace);
          return;
        }
      }
      // If no saved workspace or saved workspace not found, use the first one
      setCurrentWorkspace(workspaces[0]);
      localStorage.setItem('currentWorkspaceId', workspaces[0]._id);
    }
  }, [workspaces]);

  const value: WorkspaceContextType = {
    currentWorkspace,
    workspaces,
    isLoading,
    error,
    setCurrentWorkspace: handleSetCurrentWorkspace,
    refreshWorkspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

// Helper function to trigger workspace refresh from outside the context
export const refreshWorkspacesAfterLogin = () => {
  // This will trigger the storage event listener
  window.dispatchEvent(new StorageEvent('storage', {
    key: 'token',
    newValue: localStorage.getItem('token'),
    oldValue: null
  }));
};

export type { Workspace, CreateWorkspaceData, UpdateWorkspaceData };