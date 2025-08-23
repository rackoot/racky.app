import React from 'react';
import { Check, ChevronsUpDown, Plus, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from './workspace-context';
import { cn } from '@/lib/utils';

interface WorkspaceSelectorProps {
  showCreateButton?: boolean;
  className?: string;
}

export function WorkspaceSelector({
  showCreateButton = true,
  className,
}: WorkspaceSelectorProps) {
  const {
    currentWorkspace,
    workspaces,
    setCurrentWorkspace,
    isLoading,
    error,
  } = useWorkspace();

  // Don't render if user is not authenticated
  const token = localStorage.getItem('token');
  if (!token) {
    return null;
  }

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

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2 p-2 text-muted-foreground", className)}>
        <Building className="h-4 w-4 animate-pulse" />
        <span className="text-sm">Loading workspaces...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-2 text-sm text-red-600", className)}>
        Error loading workspaces
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between bg-background"
          >
            <div className="flex items-center gap-2 truncate">
              {currentWorkspace ? (
                <>
                  <Building className="h-4 w-4 shrink-0" />
                  <span className="truncate">{currentWorkspace.name}</span>
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs", getRoleBadgeColor(currentWorkspace.userRole))}
                  >
                    {currentWorkspace.userRole}
                  </Badge>
                </>
              ) : (
                <>
                  <Building className="h-4 w-4 shrink-0" />
                  <span className="text-muted-foreground">Select workspace...</span>
                </>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-80">
          <DropdownMenuLabel>Switch Workspace</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace._id}
              onClick={() => setCurrentWorkspace(workspace)}
              className="flex items-center justify-between p-3 cursor-pointer"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Check
                  className={cn(
                    "h-4 w-4",
                    currentWorkspace?._id === workspace._id
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{workspace.name}</span>
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", getRoleBadgeColor(workspace.userRole))}
                    >
                      {workspace.userRole}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {workspace.subscription && (
                      <Badge variant="outline" className="text-xs">
                        {workspace.subscription.plan}
                      </Badge>
                    )}
                    {workspace.memberCount && (
                      <span className="text-xs text-gray-500">
                        {workspace.memberCount} member{workspace.memberCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
          {showCreateButton && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  window.location.href = '/workspaces';
                }}
                className="cursor-pointer"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create new workspace
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}