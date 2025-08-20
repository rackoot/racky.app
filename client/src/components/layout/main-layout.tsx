import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Menu, AlertTriangle, CreditCard } from "lucide-react"
import { Link } from "react-router-dom"
import { AppSidebar } from "./app-sidebar"
import { UserProfile } from "./user-profile"
import { getCurrentUser } from "@/lib/auth"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const user = getCurrentUser()

  const shouldShowSubscriptionBanner = () => {
    if (!user?.subscriptionInfo) return false
    
    const { status, isTrialExpired, hasActiveSubscription } = user.subscriptionInfo
    
    return (
      (status === 'TRIAL' && isTrialExpired) ||
      status === 'SUSPENDED' ||
      status === 'CANCELLED' ||
      !hasActiveSubscription
    )
  }

  const getSubscriptionBannerMessage = () => {
    if (!user?.subscriptionInfo) return null
    
    const { status, isTrialExpired } = user.subscriptionInfo
    
    if (status === 'TRIAL' && isTrialExpired) {
      return {
        message: "Your free trial has expired. Upgrade to continue using all features.",
        action: "Upgrade Now",
        variant: "destructive" as const
      }
    } else if (status === 'SUSPENDED') {
      return {
        message: "Your subscription is suspended. Please update your payment method.",
        action: "Update Payment",
        variant: "destructive" as const
      }
    } else if (status === 'CANCELLED') {
      return {
        message: "Your subscription has been cancelled. Reactivate to continue.",
        action: "Reactivate",
        variant: "destructive" as const
      }
    }
    
    return null
  }

  const bannerInfo = getSubscriptionBannerMessage()

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-50 md:z-auto
        w-64 h-screen bg-sidebar border-r border-sidebar-border
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${!sidebarOpen ? 'md:w-16' : 'md:w-64'}
      `}>
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-sidebar-border flex justify-start">
            <img src="/img/icon.svg" className="w-9 mr-3" />
            <h1 className={`font-bold text-xl text-sidebar-foreground ${!sidebarOpen ? 'md:hidden' : ''}`}>
              Racky
            </h1>
            {!sidebarOpen && <div className="hidden md:block text-center text-sidebar-foreground font-bold">R</div>}
          </div>
          <nav className="flex-1 p-4">
            <AppSidebar collapsed={!sidebarOpen} />
          </nav>
          <div className="p-4 border-t border-sidebar-border">
            <UserProfile collapsed={!sidebarOpen} />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-0">
        {/* Subscription Banner */}
        {shouldShowSubscriptionBanner() && bannerInfo && (
          <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  {bannerInfo.message}
                </span>
              </div>
              <Button size="sm" variant="destructive" asChild>
                <Link to="/subscription">
                  <CreditCard className="w-4 h-4 mr-2" />
                  {bannerInfo.action}
                </Link>
              </Button>
            </div>
          </div>
        )}
        
        <header className="h-16 border-b bg-background px-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"  
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Overview of your ecommerce ecosystem
            </span>
          </div>
        </header>
        
        <main className="flex-1 p-4">
          {children}
        </main>
      </div>
    </div>
  )
}