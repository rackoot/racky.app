import {
  BarChart3,
  Home,
  Package,
  ShoppingCart,
  Store,
  Users,
  Settings,
  TrendingUp,
  CreditCard,
  Activity,
  DollarSign,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { getCurrentUser } from "@/lib/auth"

interface NavigationItem {
  title: string
  url: string
  icon: any
  requiresSubscription?: boolean
  requiresNoSubscription?: boolean
  showForSuperAdmin?: boolean
}

const items: NavigationItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
    requiresSubscription: true, // Requires active subscription
  },
  {
    title: "Stores/Marketplaces",
    url: "/stores",
    icon: Store,
    requiresSubscription: true, // Requires active subscription
  },
  {
    title: "Products",
    url: "/products",
    icon: Package,
    requiresSubscription: true, // Requires active subscription
  },
  {
    title: "Orders",
    url: "/orders",
    icon: ShoppingCart,
    requiresSubscription: true, // Requires active subscription
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
    requiresSubscription: true, // Requires active subscription
  },
  {
    title: "Usage Dashboard",
    url: "/usage",
    icon: Activity,
    requiresSubscription: true, // Requires active subscription
  },
  {
    title: "Performance",
    url: "/performance",
    icon: TrendingUp,
    requiresSubscription: true, // Requires active subscription
  },
  {
    title: "Customers",
    url: "/customers",
    icon: Users,
    requiresSubscription: true, // Requires active subscription
  },
  {
    title: "Pricing",
    url: "/pricing-internal",
    icon: DollarSign,
    requiresNoSubscription: true, // Only show when no active subscription
  },
  {
    title: "Manage Subscription",
    url: "/subscription-manage",
    icon: CreditCard,
    requiresSubscription: true, // Only show when has active subscription
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    requiresSubscription: true, // Requires active subscription
  },
]

interface AppSidebarProps {
  collapsed?: boolean
}

export function AppSidebar({ collapsed = false }: AppSidebarProps) {
  const location = useLocation()
  const { currentWorkspace } = useWorkspace()
  const user = getCurrentUser()

  // Helper function to check if user has active subscription
  const hasActiveSubscription = (): boolean => {
    // SUPERADMIN users bypass subscription requirements
    if (user?.role === 'SUPERADMIN') {
      return true
    }

    // Check workspace subscription first (primary)
    if (currentWorkspace?.subscription) {
      const { status } = currentWorkspace.subscription
      return status === 'ACTIVE'
    }

    // Fallback to user subscription info (legacy/backup)
    if (user?.subscriptionInfo) {
      return user.subscriptionInfo.hasActiveSubscription && 
             user.subscriptionInfo.status === 'ACTIVE'
    }

    return false
  }

  // Filter items based on subscription status
  const visibleItems = items.filter((item) => {
    // If item requires no subscription (only show when no subscription), check inverse
    if (item.requiresNoSubscription) {
      return !hasActiveSubscription()
    }

    // If item doesn't require subscription and doesn't require no subscription, always show it
    if (!item.requiresSubscription) {
      return true
    }

    // If item requires subscription, check if user has active subscription
    return hasActiveSubscription()
  })

  return (
    <nav className="space-y-2">
      {visibleItems.map((item) => {
        const isActive = location.pathname === item.url
        return (
          <Link
            key={item.title}
            to={item.url}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground",
              collapsed && "md:justify-center md:px-2"
            )}
            title={collapsed ? item.title : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </Link>
        )
      })}
    </nav>
  )
}