import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"

interface MetricsCardProps {
  title: string
  value: string | number
  change?: string
  changeType?: "positive" | "negative" | "neutral"
  icon: LucideIcon
}

export function MetricsCard({ title, value, change, changeType = "neutral", icon: Icon }: MetricsCardProps) {
  const getChangeColor = () => {
    switch (changeType) {
      case "positive":
        return "text-green-600"
      case "negative":
        return "text-red-600"
      default:
        return "text-muted-foreground"
    }
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium leading-none text-muted-foreground">
              {title}
            </p>
            <p className="text-2xl font-bold">{value}</p>
            {change && (
              <p className={`text-xs ${getChangeColor()}`}>
                {change}
              </p>
            )}
          </div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}