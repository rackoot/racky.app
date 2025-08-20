import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { AppSidebar } from "./app-sidebar"
import { UserProfile } from "./user-profile"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

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