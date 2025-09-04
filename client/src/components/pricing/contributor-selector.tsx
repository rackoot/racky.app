import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { 
  UserCheck, 
  Crown, 
  Zap,
  Mail,
  ArrowRight,
  Info
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { getCurrentUser } from "@/lib/auth"
import { getAuthHeaders } from "@/lib/utils"
import { EmbeddedCheckoutWrapper } from "./embedded-checkout"
import { Plan, ContributorType } from "@/types/plan"

const contributorPlans: Plan[] = [
  {
    _id: 'junior-plan',
    displayName: "Junior Contributor",
    description: "Perfect for small teams getting started with marketplace automation",
    contributorType: 'JUNIOR',
    actionsPerContributor: 1000,
    maxContributorsPerWorkspace: 5,
    isContactSalesOnly: false,
    monthlyPrice: 2900, // $29.00 per contributor
    stripeMonthlyPriceId: '',
    limits: {
      maxStores: 5,
      maxProducts: 100,
      maxMarketplaces: 2,
      maxSyncFrequency: 24,
      apiCallsPerMonth: 1000
    },
    features: [
      { name: 'Basic Operations', description: 'Essential marketplace tasks and product sync', enabled: true },
      { name: 'Email Support', description: 'Email support with 48-hour response time', enabled: true },
      { name: '1K Actions/Contributor', description: 'Up to 1,000 actions per contributor monthly', enabled: true },
      { name: 'Basic Analytics', description: 'Essential performance metrics', enabled: true },
      { name: 'Product Management', description: 'Create, update, and sync products', enabled: true }
    ],
    trialDays: 14,
    createdAt: '',
    updatedAt: ''
  },
  {
    _id: 'senior-plan',
    displayName: "Senior Contributor",
    description: "Advanced contributors with AI assistance for growing businesses",
    contributorType: 'SENIOR',
    actionsPerContributor: 5000,
    maxContributorsPerWorkspace: 5,
    isContactSalesOnly: false,
    monthlyPrice: 7900, // $79.00 per contributor
    stripeMonthlyPriceId: '',
    limits: {
      maxStores: 25,
      maxProducts: 1000,
      maxMarketplaces: 5,
      maxSyncFrequency: 6,
      apiCallsPerMonth: 5000
    },
    features: [
      { name: 'Advanced Operations', description: 'Complex automation and bulk operations', enabled: true },
      { name: 'AI-Powered Insights', description: 'Smart suggestions and optimization recommendations', enabled: true },
      { name: 'Priority Support', description: 'Priority email and chat support', enabled: true },
      { name: '5K Actions/Contributor', description: 'Up to 5,000 actions per contributor monthly', enabled: true },
      { name: 'Advanced Analytics', description: 'Detailed performance metrics and reporting', enabled: true },
      { name: 'Bulk Operations', description: 'Mass updates across multiple marketplaces', enabled: true }
    ],
    trialDays: 14,
    createdAt: '',
    updatedAt: ''
  },
  {
    _id: 'executive-plan',
    displayName: "Executive Contributor",
    description: "Premium contributors with unlimited capabilities and dedicated support",
    contributorType: 'EXECUTIVE',
    actionsPerContributor: -1, // Unlimited
    maxContributorsPerWorkspace: 50,
    isContactSalesOnly: true,
    monthlyPrice: 19900, // Contact for pricing
    stripeMonthlyPriceId: '',
    limits: {
      maxStores: -1, // Unlimited
      maxProducts: -1,
      maxMarketplaces: -1,
      maxSyncFrequency: 1,
      apiCallsPerMonth: -1
    },
    features: [
      { name: 'Unlimited Operations', description: 'No limits on actions or complexity', enabled: true },
      { name: 'Custom AI Models', description: 'Tailored AI solutions for your business', enabled: true },
      { name: 'Dedicated Support', description: '24/7 dedicated account manager', enabled: true },
      { name: 'Unlimited Actions', description: 'No monthly action limits', enabled: true },
      { name: 'Custom Integrations', description: 'Bespoke marketplace and tool integrations', enabled: true },
      { name: 'White-label Solution', description: 'Branded interface and API access', enabled: true }
    ],
    trialDays: 30,
    createdAt: '',
    updatedAt: ''
  }
]

interface ContributorSelectorProps {
  showHeader?: boolean
  title?: string
  description?: string
  onSubscriptionComplete?: () => void
  isReactivation?: boolean
}

export function ContributorSelector({ 
  showHeader = true, 
  title = "Hire AI Contributors for Your Marketplace",
  description = "Choose the right contributors to automate your marketplace operations. Each contributor performs actions on your behalf.",
  onSubscriptionComplete,
  isReactivation = false
}: ContributorSelectorProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [contributorCount, setContributorCount] = useState([1])
  const [loading, setLoading] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const navigate = useNavigate()
  const user = getCurrentUser()

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(0)
  }

  const calculateTotalPrice = (plan: Plan, count: number) => {
    const pricePerContributor = formatPrice(plan.monthlyPrice)
    const totalPrice = (plan.monthlyPrice * count / 100)
    
    return {
      perContributor: pricePerContributor,
      total: totalPrice.toFixed(0)
    }
  }

  const calculateTotalActions = (plan: Plan, count: number) => {
    if (plan.actionsPerContributor === -1) return 'Unlimited'
    return (plan.actionsPerContributor * count).toLocaleString()
  }

  const getContributorIcon = (type: ContributorType) => {
    switch (type) {
      case 'JUNIOR':
        return <Zap className="w-8 h-8 text-blue-600" />
      case 'SENIOR':
        return <UserCheck className="w-8 h-8 text-green-600" />
      case 'EXECUTIVE':
        return <Crown className="w-8 h-8 text-purple-600" />
    }
  }

  const handlePlanSelect = (plan: Plan) => {
    if (plan.isContactSalesOnly) {
      // Handle Executive plan - redirect to Monday.com form
      window.open('https://forms.monday.com/forms/226e77aa9d94bc45ae4ec3dd8518b5c0?r=use1', '_blank')
      return
    }
    
    setSelectedPlan(plan)
    setContributorCount([1]) // Reset to 1 contributor
  }

  const handleHireContributors = async () => {
    if (!selectedPlan || !user) {
      navigate('/register')
      return
    }

    setShowCheckout(true)
  }

  const handleCheckoutSuccess = () => {
    // Call the completion callback if provided (for reactivation)
    if (onSubscriptionComplete) {
      onSubscriptionComplete()
    } else {
      // Redirect to dashboard with success message
      navigate('/dashboard?checkout=success&plan=' + selectedPlan?.contributorType)
    }
  }

  const handleCheckoutBack = () => {
    setShowCheckout(false)
  }

  // Show checkout if user has selected plan and clicked hire
  if (showCheckout && selectedPlan && user) {
    return (
      <EmbeddedCheckoutWrapper
        contributorType={selectedPlan.contributorType}
        contributorCount={contributorCount[0]}
        onBack={handleCheckoutBack}
        onSuccess={handleCheckoutSuccess}
        isReactivation={isReactivation}
      />
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      {showHeader && (
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">
            {title}
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            {description}
          </p>
        </div>
      )}
      

      {/* Contributor Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {contributorPlans.map((plan) => (
          <Card 
            key={plan.contributorType} 
            className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg ${
              selectedPlan?.contributorType === plan.contributorType ? 'ring-2 ring-primary shadow-lg' : ''
            } ${plan.contributorType === 'SENIOR' ? 'border-primary' : ''}`}
            onClick={() => handlePlanSelect(plan)}
          >
            {plan.contributorType === 'SENIOR' && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="px-3 py-1">Most Popular</Badge>
              </div>
            )}
            
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                {getContributorIcon(plan.contributorType)}
              </div>
              <CardTitle className="text-2xl">{plan.displayName}</CardTitle>
              <CardDescription className="text-base">{plan.description}</CardDescription>
              
              <div className="mt-6">
                <div className="text-4xl font-bold">
                  {plan.isContactSalesOnly ? 'Custom' : (
                    `$${formatPrice(plan.monthlyPrice)}`
                  )}
                </div>
                <div className="text-muted-foreground">
                  {plan.isContactSalesOnly ? 'Contact for pricing' : 'per contributor/month'}
                </div>
                <div className="text-sm text-green-600 font-medium mt-1">
                  {plan.actionsPerContributor === -1 ? 'Unlimited actions' : 
                   `${plan.actionsPerContributor.toLocaleString()} actions per contributor`
                  }
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Key Features */}
              <div className="space-y-2">
                {plan.features.slice(0, 3).map((feature, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="text-sm">
                      <span className="font-medium">{feature.name}</span>
                      <div className="text-muted-foreground text-xs">{feature.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              {plan.isContactSalesOnly ? (
                <Button className="w-full mt-6" size="lg">
                  <Mail className="w-4 h-4 mr-2" />
                  Get in Touch
                </Button>
              ) : (
                <Button 
                  className="w-full mt-6" 
                  size="lg"
                  variant={selectedPlan?.contributorType === plan.contributorType ? 'default' : 'outline'}
                >
                  Select {plan.displayName}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contributor Count Selector */}
      {selectedPlan && !selectedPlan.isContactSalesOnly && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getContributorIcon(selectedPlan.contributorType)}
              Configure Your {selectedPlan.displayName}s
            </CardTitle>
            <CardDescription>
              Choose how many {selectedPlan.displayName.toLowerCase()}s you want to hire
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Slider */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">Number of Contributors</label>
                <span className="text-2xl font-bold">{contributorCount[0]}</span>
              </div>
              <Slider
                value={contributorCount}
                onValueChange={setContributorCount}
                max={selectedPlan.maxContributorsPerWorkspace}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 contributor</span>
                <span>{selectedPlan.maxContributorsPerWorkspace} contributors</span>
              </div>
            </div>

            {/* Pricing Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Price per contributor:</span>
                <span className="font-medium">
                  ${calculateTotalPrice(selectedPlan, 1).perContributor}/month
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total monthly actions:</span>
                <span className="font-medium">
                  {calculateTotalActions(selectedPlan, contributorCount[0])}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-lg font-semibold">Total Monthly Cost:</span>
                <span className="text-2xl font-bold text-primary">
                  ${calculateTotalPrice(selectedPlan, contributorCount[0]).total}
                </span>
              </div>
            </div>

            {/* Hire Button */}
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleHireContributors}
              disabled={loading}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
              ) : (
                <>
                  Hire {contributorCount[0]} {selectedPlan.displayName}
                  {contributorCount[0] > 1 ? 's' : ''}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}