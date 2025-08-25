import { PricingContent } from "@/components/pricing/pricing-content"

export function InternalPricing() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Choose Your Plan</h1>
        <p className="text-muted-foreground">
          Unlock the full potential of your workspace with a subscription that fits your needs.
        </p>
      </div>

      {/* Pricing Content */}
      <PricingContent 
        showHeader={false}
      />
    </div>
  )
}