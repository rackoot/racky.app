import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Workspace {
  _id: string;
  name: string;
  slug: string;
  userRole: 'OWNER' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
  memberCount?: number;
  subscription?: {
    status: string;
    plan: string;
    endsAt?: Date;
  };
}

interface WorkspaceSelectorProps {
  currentWorkspace?: Workspace;
  workspaces: Workspace[];
  onWorkspaceChange: (workspace: Workspace) => void;
  onCreateWorkspace: () => void;
  onManageWorkspace: (workspace: Workspace) => void;
}

export function WorkspaceSelector({
  currentWorkspace,
  workspaces,
  onWorkspaceChange,
  onCreateWorkspace,
  onManageWorkspace,
}: WorkspaceSelectorProps) {
  const [open, setOpen] = useState(false);

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-white"
        >
          <div className="flex items-center gap-2 truncate">
            {currentWorkspace ? (
              <>
                <span className="truncate">{currentWorkspace.name}</span>
                <Badge 
                  variant="outline" 
                  className={cn("text-xs", getRoleBadgeColor(currentWorkspace.userRole))}
                >
                  {currentWorkspace.userRole}
                </Badge>
              </>
            ) : (
              "Select workspace..."
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search workspaces..." />
          <CommandEmpty>No workspace found.</CommandEmpty>
          <CommandGroup>
            {workspaces.map((workspace) => (
              <CommandItem
                key={workspace._id}
                value={workspace.name}
                onSelect={() => {
                  onWorkspaceChange(workspace);
                  setOpen(false);
                }}
                className="flex items-center justify-between p-3"
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
                        <Badge 
                          variant="outline" 
                          className={cn("text-xs", getSubscriptionBadgeColor(workspace.subscription.status))}
                        >
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
                {(workspace.userRole === 'OWNER' || workspace.userRole === 'ADMIN') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 ml-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onManageWorkspace(workspace);
                      setOpen(false);
                    }}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
          <div className="border-t p-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                onCreateWorkspace();
                setOpen(false);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create new workspace
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}