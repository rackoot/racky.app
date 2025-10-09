import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Home, AlertCircle } from "lucide-react"

export function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-6 max-w-md px-4">
        <AlertCircle className="w-20 h-20 mx-auto text-muted-foreground" />
        <div className="space-y-2">
          <h1 className="text-4xl font-bold">404</h1>
          <p className="text-xl font-semibold">Page Not Found</p>
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard')}>
          <Home className="w-4 h-4 mr-2" />
          Go to Dashboard
        </Button>
      </div>
    </div>
  )
}
