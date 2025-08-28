import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, CheckCircle2, XCircle, Zap } from "lucide-react"
import { useOptimizationProgress } from "@/hooks/useOptimizationProgress"

interface OptimizationProgressBarProps {
  productId: string
  platform: string
  platformName: string
  onComplete?: () => void
}

export function OptimizationProgressBar({ 
  productId, 
  platform, 
  platformName, 
  onComplete 
}: OptimizationProgressBarProps) {
  const { progress, startOptimization, reset, isProcessing } = useOptimizationProgress(productId, platform)

  const handleStart = async () => {
    const cleanup = await startOptimization()
    
    // Simulate completion after some time
    setTimeout(() => {
      cleanup?.()
      onComplete?.()
    }, 8000)
  }

  if (progress.status === 'idle') {
    return (
      <div className="flex items-center justify-center p-6">
        <Button onClick={handleStart} className="bg-blue-600 hover:bg-blue-700">
          <Zap className="w-4 h-4 mr-2" />
          Start AI Optimization for {platformName}
        </Button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {progress.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-blue-600" />}
          {progress.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
          {progress.status === 'failed' && <XCircle className="w-5 h-5 text-red-600" />}
          
          <h3 className="font-semibold">
            AI Optimization for {platformName}
          </h3>
        </div>
        
        <Badge 
          variant={progress.status === 'completed' ? 'default' : progress.status === 'failed' ? 'destructive' : 'secondary'}
        >
          {progress.status === 'processing' && 'Processing...'}
          {progress.status === 'completed' && 'Completed'}
          {progress.status === 'failed' && 'Failed'}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{Math.round(progress.progress)}%</span>
        </div>
        <Progress value={progress.progress} className="w-full" />
        <div className="text-sm text-muted-foreground text-center">
          {progress.eta}
        </div>
      </div>

      {progress.status === 'completed' && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={reset}>
            Start Another Optimization
          </Button>
        </div>
      )}

      {progress.status === 'failed' && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={reset}>
            Try Again
          </Button>
        </div>
      )}
    </div>
  )
}