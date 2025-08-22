import React, { useState } from 'react';
import { Plus, Settings, Users, Crown, Shield, Eye, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { WorkspaceSelector } from '@/components/workspace/workspace-selector';
import { cn } from '@/lib/utils';

const getRoleIcon = (role: string) => {
  switch (role) {
    case 'OWNER':
      return <Crown className="h-4 w-4" />;
    case 'ADMIN':
      return <Shield className="h-4 w-4" />;
    case 'OPERATOR':
      return <Play className="h-4 w-4" />;
    case 'VIEWER':
      return <Eye className="h-4 w-4" />;
    default:
      return <Users className="h-4 w-4" />;
  }
};

const getRoleBadgeColor = (role: string) => {
  switch (role) {
    case 'OWNER':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'ADMIN':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'OPERATOR':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'VIEWER':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getSubscriptionBadgeColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'trial':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'suspended':
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function WorkspacesPage() {
  const {
    workspaces,
    currentWorkspace,
    isLoading,
    error,
    setCurrentWorkspace,
    createWorkspace,
  } = useWorkspace();
  
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateWorkspace = async () => {
    setIsCreating(true);
    try {
      // For demo purposes, create a workspace with a random name
      const workspaceName = `New Workspace ${Date.now()}`;
      await createWorkspace({
        name: workspaceName,
        description: 'A new workspace for managing your e-commerce operations',
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          language: 'en',
        },
      });
    } catch (err) {
      console.error('Failed to create workspace:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleManageWorkspace = (workspace: any) => {
    // Navigate to workspace management page
    console.log('Manage workspace:', workspace);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading workspaces...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600">Error loading workspaces: {error}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workspaces</h1>
          <p className="text-gray-600">Manage your workspaces and switch between them</p>
        </div>
        <Button
          onClick={handleCreateWorkspace}
          disabled={isCreating}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          {isCreating ? 'Creating...' : 'New Workspace'}
        </Button>
      </div>

      {/* Current Workspace Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Current Workspace</CardTitle>
          <CardDescription>
            Select the workspace you want to work in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceSelector
            currentWorkspace={currentWorkspace}
            workspaces={workspaces}
            onWorkspaceChange={setCurrentWorkspace}
            onCreateWorkspace={handleCreateWorkspace}
            onManageWorkspace={handleManageWorkspace}
          />
        </CardContent>
      </Card>

      {/* All Workspaces */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">All Workspaces</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card
              key={workspace._id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                currentWorkspace?._id === workspace._id && "ring-2 ring-blue-500"
              )}
              onClick={() => setCurrentWorkspace(workspace)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg truncate">{workspace.name}</CardTitle>
                  {(workspace.userRole === 'OWNER' || workspace.userRole === 'ADMIN') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleManageWorkspace(workspace);
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {workspace.description && (
                  <CardDescription className="line-clamp-2">
                    {workspace.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  {getRoleIcon(workspace.userRole)}
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", getRoleBadgeColor(workspace.userRole))}
                  >
                    {workspace.userRole}
                  </Badge>
                </div>

                {workspace.subscription && (
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", getSubscriptionBadgeColor(workspace.subscription.status))}
                    >
                      {workspace.subscription.plan} - {workspace.subscription.status}
                    </Badge>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {workspace.memberCount || 1} member{(workspace.memberCount || 1) !== 1 ? 's' : ''}
                  </span>
                  {currentWorkspace?._id === workspace._id && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                      Current
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {workspaces.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No workspaces found</h3>
            <p className="text-gray-600 text-center mb-6">
              Create your first workspace to start managing your e-commerce operations
            </p>
            <Button
              onClick={handleCreateWorkspace}
              disabled={isCreating}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              {isCreating ? 'Creating...' : 'Create Your First Workspace'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}