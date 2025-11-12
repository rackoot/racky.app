import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Users, BarChart3, Settings, Shield, CreditCard, Activity, Home, Briefcase, BookOpen, Webhook } from "lucide-react"
import { UserProfile } from "./user-profile"
import { getCurrentUser } from "@/lib/auth"

interface AdminLayoutProps {
  children: React.ReactNode
}

const adminNavItems = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: Home,
    description: "Admin dashboard overview"
  },
  {
    title: "Users",
    href: "/admin/users",
    icon: Users,
    description: "Manage user accounts and subscriptions"
  },
  {
    title: "Workspaces",
    href: "/admin/workspaces",
    icon: Briefcase,
    description: "View all workspaces and their resources"
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    description: "Platform usage and revenue analytics"
  },
  {
    title: "Subscriptions",
    href: "/admin/subscriptions",
    icon: CreditCard,
    description: "Monitor subscription status and billing"
  },
  {
    title: "Webhooks",
    href: "/admin/webhooks",
    icon: Webhook,
    description: "Manage webhook URLs for video events"
  },
  {
    title: "System",
    href: "/admin/system",
    icon: Activity,
    description: "System health and performance monitoring"
  },
  {
    title: "API Documentation",
    href: "/admin/api-docs",
    icon: BookOpen,
    description: "View API endpoints documentation"
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
    description: "Platform configuration and settings"
  }
]

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation()
  const user = getCurrentUser()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/admin" className="flex items-center gap-2">
                <Shield className="w-8 h-8 text-primary" />
                <div>
                  <h1 className="text-xl font-bold">Racky Admin</h1>
                  <p className="text-xs text-muted-foreground">Platform Management</p>
                </div>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {user?.role !== 'SUPERADMIN' && (
                <Link 
                  to="/dashboard" 
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Back to App
                </Link>
              )}
              <UserProfile />
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-[calc(100vh-73px)] sticky top-[73px]">
          <nav className="p-4">
            <div className="space-y-2">
              {adminNavItems.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200"
                    )}
                  >
                    <item.icon className={cn(
                      "w-5 h-5",
                      isActive ? "text-primary" : "text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300"
                    )} />
                    <div className="flex-1">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-xs text-muted-foreground">{item.description}</div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}