import {
  BarChart3,
  Home,
  Package,
  ShoppingCart,
  Store,
  Users,
  Settings,
  TrendingUp,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"

const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "Stores/Marketplaces",
    url: "/stores",
    icon: Store,
  },
  {
    title: "Products",
    url: "/products",
    icon: Package,
  },
  {
    title: "Orders",
    url: "/orders",
    icon: ShoppingCart,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Performance",
    url: "/performance",
    icon: TrendingUp,
  },
  {
    title: "Customers",
    url: "/customers",
    icon: Users,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
]

interface AppSidebarProps {
  collapsed?: boolean
}

export function AppSidebar({ collapsed = false }: AppSidebarProps) {
  const location = useLocation()

  return (
    <nav className="space-y-2">
      {items.map((item) => {
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