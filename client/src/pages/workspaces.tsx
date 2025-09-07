import { useState } from 'react';
import { Plus, Settings, Users, Crown, Shield, Eye, Play, MoreVertical, Edit, UserPlus, Cog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useWorkspace } from '@/components/workspace/workspace-context';
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
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'ADMIN':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'OPERATOR':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'VIEWER':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getSubscriptionPlanBadgeColor = (plan: string) => {
  switch (plan?.toLowerCase()) {
    case 'junior':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'senior':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'executive':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getSubscriptionStatusBadgeColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'trial':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'suspended':
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'expired':
      return 'bg-orange-100 text-orange-800 border-orange-200';
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
    updateWorkspace,
  } = useWorkspace();
  
  const [isCreating, setIsCreating] = useState(false);
  const [renameDialog, setRenameDialog] = useState<{
    isOpen: boolean;
    workspace: any | null;
    newName: string;
    isUpdating: boolean;
  }>({
    isOpen: false,
    workspace: null,
    newName: '',
    isUpdating: false,
  });

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

  const handleRenameWorkspace = (workspace: any) => {
    setRenameDialog({
      isOpen: true,
      workspace,
      newName: workspace.name,
      isUpdating: false,
    });
  };

  const handleRenameSubmit = async () => {
    if (!renameDialog.workspace || !renameDialog.newName.trim()) return;

    setRenameDialog(prev => ({ ...prev, isUpdating: true }));
    
    try {
      await updateWorkspace(renameDialog.workspace._id, {
        name: renameDialog.newName.trim(),
      });
      
      setRenameDialog({
        isOpen: false,
        workspace: null,
        newName: '',
        isUpdating: false,
      });
    } catch (err) {
      console.error('Failed to rename workspace:', err);
    } finally {
      setRenameDialog(prev => ({ ...prev, isUpdating: false }));
    }
  };

  const handleRenameCancel = () => {
    setRenameDialog({
      isOpen: false,
      workspace: null,
      newName: '',
      isUpdating: false,
    });
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


      {/* Workspaces Grid */}
      <div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card
              key={workspace._id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md",
                currentWorkspace?._id === workspace._id && "ring-2 ring-blue-500",
                !workspace.subscription && "!bg-gray-100"
              )}
              onClick={() => setCurrentWorkspace(workspace)}
            >
              <CardHeader className={cn("pb-3", !workspace.subscription && "!bg-gray-100")}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg truncate">{workspace.name}</CardTitle>
                  {(workspace.userRole === 'OWNER' || workspace.userRole === 'ADMIN') && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <Cog className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameWorkspace(workspace);
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Rename Workspace
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled className="opacity-50">
                          <Users className="mr-2 h-4 w-4" />
                          Users and Roles
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled className="opacity-50">
                          <UserPlus className="mr-2 h-4 w-4" />
                          Invite Users
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled className="opacity-50">
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                {workspace.description && (
                  <CardDescription className="line-clamp-2">
                    {workspace.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className={cn("space-y-3", !workspace.subscription && "!bg-gray-100")}>
                <div className="flex items-center gap-2 flex-wrap">
                  {getRoleIcon(workspace.userRole)}
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", getRoleBadgeColor(workspace.userRole))}
                  >
                    {workspace.userRole}
                  </Badge>
                  
                  {/* Subscription Plan Badge */}
                  {workspace.subscription ? (
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", getSubscriptionPlanBadgeColor(workspace.subscription.plan))}
                    >
                      {workspace.subscription.plan}
                    </Badge>
                  ) : null}
                  
                  {/* Subscription Status Badge */}
                  {workspace.subscription ? (
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", getSubscriptionStatusBadgeColor(workspace.subscription.status))}
                    >
                      {workspace.subscription.status}
                    </Badge>
                  ) : (
                    <Badge 
                      variant="outline" 
                      className="text-xs bg-red-100 text-red-800 border-red-200"
                    >
                      INACTIVE
                    </Badge>
                  )}
                </div>

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

      {/* Rename Workspace Dialog */}
      <Dialog open={renameDialog.isOpen} onOpenChange={handleRenameCancel}>
        <DialogContent className="sm:max-w-[425px] z-50">
          <DialogHeader>
            <DialogTitle>Rename Workspace</DialogTitle>
            <DialogDescription>
              Enter a new name for "{renameDialog.workspace?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace Name</Label>
              <Input
                id="workspace-name"
                value={renameDialog.newName}
                onChange={(e) => 
                  setRenameDialog(prev => ({ ...prev, newName: e.target.value }))
                }
                placeholder="Enter workspace name"
                disabled={renameDialog.isUpdating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handleRenameCancel}
              disabled={renameDialog.isUpdating}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRenameSubmit}
              disabled={renameDialog.isUpdating || !renameDialog.newName.trim()}
            >
              {renameDialog.isUpdating ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}