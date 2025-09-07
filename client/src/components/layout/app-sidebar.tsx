import {
  BarChart3,
  Brain,
  Home,
  Package,
  ShoppingCart,
  Store,
  Users,
  CreditCard,
  Activity,
  DollarSign,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/components/workspace/workspace-context"
import { getCurrentUser } from "@/lib/auth"

interface NavigationSubItem {
  title: string
  url: string
}

interface NavigationItem {
  title: string
  url?: string
  icon: any
  requiresSubscription?: boolean
  requiresNoSubscription?: boolean
  showForSuperAdmin?: boolean
  subitems?: NavigationSubItem[]
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
    title: "AI Optimization",
    icon: Brain,
    requiresSubscription: true, // Requires active subscription
    subitems: [
      { title: "Start AI Scan", url: "/ai-optimization/start-scan" },
      { title: "Scan History", url: "/ai-optimization/scan-history" },
    ]
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
]

interface AppSidebarProps {
  collapsed?: boolean
}

export function AppSidebar({ collapsed = false }: AppSidebarProps) {
  const location = useLocation()
  const { currentWorkspace } = useWorkspace()
  const user = getCurrentUser()
  const [expandedItems, setExpandedItems] = useState<string[]>([])

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

  // Helper to check if any subitem is active
  const isSubitemActive = (subitems?: NavigationSubItem[]) => {
    if (!subitems) return false
    return subitems.some(subitem => location.pathname === subitem.url)
  }

  // Helper to check if item should be expanded (has active subitem)
  const shouldBeExpanded = (item: NavigationItem) => {
    return isSubitemActive(item.subitems) || expandedItems.includes(item.title)
  }

  const toggleExpanded = (itemTitle: string) => {
    setExpandedItems(prev => 
      prev.includes(itemTitle) 
        ? prev.filter(title => title !== itemTitle)
        : [...prev, itemTitle]
    )
  }

  return (
    <nav className="space-y-2">
      {visibleItems.map((item) => {
        const isActive = item.url ? location.pathname === item.url : false
        const hasSubitems = item.subitems && item.subitems.length > 0
        const isExpanded = shouldBeExpanded(item)
        const hasActiveSubitem = isSubitemActive(item.subitems)

        return (
          <div key={item.title}>
            {item.url ? (
              // Regular navigation item with direct URL
              <Link
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
            ) : (
              // Navigation item with subitems (expandable)
              <div>
                <button
                  onClick={() => hasSubitems && toggleExpanded(item.title)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    hasActiveSubitem
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground",
                    collapsed && "md:justify-center md:px-2"
                  )}
                  title={collapsed ? item.title : undefined}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.title}</span>
                      {hasSubitems && (
                        isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0" />
                        )
                      )}
                    </>
                  )}
                </button>
                
                {/* Subitems */}
                {hasSubitems && isExpanded && !collapsed && (
                  <div className="ml-7 mt-1 space-y-1">
                    {item.subitems!.map((subitem) => {
                      const isSubitemActiveNow = location.pathname === subitem.url
                      return (
                        <Link
                          key={subitem.url}
                          to={subitem.url}
                          className={cn(
                            "block rounded-lg px-3 py-1.5 text-sm transition-colors",
                            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            isSubitemActiveNow
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/80"
                          )}
                        >
                          {subitem.title}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}