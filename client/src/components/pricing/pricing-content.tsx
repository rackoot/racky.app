import { ContributorSelector } from "./contributor-selector"

interface PricingContentProps {
  showHeader?: boolean
  title?: string
  description?: string
}

export function PricingContent({ 
  showHeader = true, 
  title = "Hire AI Contributors for Your Marketplace",
  description = "Choose the right contributors to automate your marketplace operations. Each contributor performs actions on your behalf."
}: PricingContentProps) {
  return (
    <ContributorSelector 
      showHeader={showHeader}
      title={title}
      description={description}
    />
  )
}