import { useState } from "react"
import { User, Settings, LogOut, Shield, CreditCard, AlertTriangle } from "lucide-react"
import { useNavigate, Link } from "react-router-dom"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCurrentUser, getUserDisplayName, getUserInitials, getRandomColorForUser, logout } from "@/lib/auth"
import { cn } from "@/lib/utils"

interface UserProfileProps {
  collapsed?: boolean
}

export function UserProfile({ collapsed = false }: UserProfileProps) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const user = getCurrentUser()

  if (!user) {
    return null
  }

  const displayName = getUserDisplayName(user)
  const initials = getUserInitials(user)
  const avatarColor = getRandomColorForUser(user)

  const handleEditAccount = () => {
    navigate('/account')
    setIsOpen(false)
  }

  const handleLogout = () => {
    logout()
  }

  const getSubscriptionStatus = () => {
    // SUPERADMIN users don't need subscriptions
    if (user?.role === 'SUPERADMIN') {
      return { text: 'Admin', variant: 'secondary' as const, icon: null }
    }
    
    if (!user?.subscriptionInfo) return { text: 'No Subscription', variant: 'destructive' as const, icon: AlertTriangle }
    
    const { status, hasActiveSubscription } = user.subscriptionInfo
    
    if (status === 'ACTIVE' && hasActiveSubscription) {
      return { text: 'Active', variant: 'default' as const, icon: null }
    } else if (status === 'SUSPENDED') {
      return { text: 'Suspended', variant: 'destructive' as const, icon: AlertTriangle }
    } else if (status === 'CANCELLED') {
      return { text: 'Cancelled', variant: 'destructive' as const, icon: AlertTriangle }
    } else if (status === 'EXPIRED') {
      return { text: 'Expired', variant: 'destructive' as const, icon: AlertTriangle }
    } else if (!hasActiveSubscription) {
      return { text: 'Inactive', variant: 'destructive' as const, icon: AlertTriangle }
    }
    
    return { text: 'Unknown', variant: 'outline' as const, icon: null }
  }

  const subscriptionStatus = getSubscriptionStatus()

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "text-sidebar-foreground",
            collapsed && "md:justify-center md:px-2"
          )}
          title={collapsed ? displayName : undefined}
        >
          <div className={cn(
            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold",
            avatarColor
          )}>
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 text-left min-w-0">
              <div className="truncate font-medium">{displayName}</div>
              <div className="flex items-center gap-2">
                <div className="truncate text-xs text-sidebar-foreground/60">{user.email}</div>
                {subscriptionStatus && (
                  <Badge variant={subscriptionStatus.variant} className="text-xs px-1 py-0">
                    {subscriptionStatus.text}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align={collapsed ? "center" : "end"}
        side={collapsed ? "right" : "top"}
        className="w-56"
        sideOffset={8}
      >
        <div className="px-2 py-1.5">
          <div className="text-sm font-medium">{displayName}</div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-muted-foreground">{user.email}</div>
            {subscriptionStatus && (
              <Badge variant={subscriptionStatus.variant} className="text-xs px-1 py-0">
                {subscriptionStatus.icon && <subscriptionStatus.icon className="w-3 h-3 mr-1" />}
                {subscriptionStatus.text}
              </Badge>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleEditAccount}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Account Settings</span>
        </DropdownMenuItem>
        {user.role !== 'SUPERADMIN' && (
          <DropdownMenuItem asChild>
            <Link to="/subscription" onClick={() => setIsOpen(false)}>
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Subscription</span>
            </Link>
          </DropdownMenuItem>
        )}
        {user.role === 'SUPERADMIN' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/admin" onClick={() => setIsOpen(false)}>
                <Shield className="mr-2 h-4 w-4" />
                <span>Admin Panel</span>
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}