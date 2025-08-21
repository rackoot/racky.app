import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Check, 
  Zap, 
  Crown, 
  Rocket,
  Store,
  Package,
  Activity,
  Shield,
  Headphones,
  Globe,
  ArrowRight
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { getCurrentUser } from "@/lib/auth"

interface Plan {
  name: string
  displayName: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  popular?: boolean
  limits: {
    maxStores: number
    maxProducts: number
    maxMarketplaces: number
    maxSyncFrequency: number
    apiCallsPerMonth: number
  }
  features: Array<{
    name: string
    description: string
    enabled: boolean
  }>
}

const plans: Plan[] = [
  {
    name: "BASIC",
    displayName: "Basic",
    description: "Perfect for small businesses getting started",
    monthlyPrice: 2900, // $29.00 in cents
    yearlyPrice: 29000, // $290.00 in cents (2 months free)
    limits: {
      maxStores: 2,
      maxProducts: 1000,
      maxMarketplaces: 2,
      maxSyncFrequency: 24,
      apiCallsPerMonth: 5000
    },
    features: [
      { name: "Store Connections", description: "Connect up to 2 stores", enabled: true },
      { name: "Product Management", description: "Manage up to 1,000 products", enabled: true },
      { name: "Basic Analytics", description: "Essential performance metrics", enabled: true },
      { name: "Email Support", description: "Support via email", enabled: true },
      { name: "AI Suggestions", description: "AI-powered recommendations", enabled: false },
      { name: "Advanced Analytics", description: "Deep insights and reporting", enabled: false },
      { name: "Priority Support", description: "24/7 priority support", enabled: false },
      { name: "Custom Integrations", description: "Build custom marketplace connections", enabled: false }
    ]
  },
  {
    name: "PRO",
    displayName: "Professional",
    description: "Ideal for growing businesses with multiple channels",
    monthlyPrice: 7900, // $79.00 in cents
    yearlyPrice: 79000, // $790.00 in cents (2 months free)
    popular: true,
    limits: {
      maxStores: 5,
      maxProducts: 10000,
      maxMarketplaces: 5,
      maxSyncFrequency: 12,
      apiCallsPerMonth: 25000
    },
    features: [
      { name: "Store Connections", description: "Connect up to 5 stores", enabled: true },
      { name: "Product Management", description: "Manage up to 10,000 products", enabled: true },
      { name: "Advanced Analytics", description: "Deep insights and reporting", enabled: true },
      { name: "AI Suggestions", description: "AI-powered recommendations", enabled: true },
      { name: "Priority Support", description: "Priority email and chat support", enabled: true },
      { name: "Bulk Operations", description: "Mass product updates", enabled: true },
      { name: "Custom Integrations", description: "Build custom marketplace connections", enabled: false },
      { name: "Dedicated Manager", description: "Personal account manager", enabled: false }
    ]
  },
  {
    name: "ENTERPRISE",
    displayName: "Enterprise",
    description: "Comprehensive solution for large-scale operations",
    monthlyPrice: 19900, // $199.00 in cents
    yearlyPrice: 199000, // $1990.00 in cents (2 months free)
    limits: {
      maxStores: 20,
      maxProducts: 100000,
      maxMarketplaces: 10,
      maxSyncFrequency: 1,
      apiCallsPerMonth: 100000
    },
    features: [
      { name: "Store Connections", description: "Connect up to 20 stores", enabled: true },
      { name: "Product Management", description: "Manage up to 100,000 products", enabled: true },
      { name: "Advanced Analytics", description: "Deep insights and reporting", enabled: true },
      { name: "AI Suggestions", description: "AI-powered recommendations", enabled: true },
      { name: "Priority Support", description: "24/7 priority support", enabled: true },
      { name: "Bulk Operations", description: "Mass product updates", enabled: true },
      { name: "Custom Integrations", description: "Build custom marketplace connections", enabled: true },
      { name: "Dedicated Manager", description: "Personal account manager", enabled: true }
    ]
  }
]

export function Pricing() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const user = getCurrentUser()

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(0)
  }

  const formatYearlyPrice = (cents: number) => {
    return (cents / 100 / 12).toFixed(0)
  }

  const handleGetStarted = async (planName: string) => {
    if (!user) {
      navigate('/register')
      return
    }

    setLoading(true)
    // In a real implementation, this would create a Stripe checkout session
    // For now, just redirect to subscription page
    setTimeout(() => {
      navigate('/subscription')
      setLoading(false)
    }, 1000)
  }

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'BASIC':
        return <Zap className="w-8 h-8 text-blue-600" />
      case 'PRO':
        return <Crown className="w-8 h-8 text-yellow-600" />
      case 'ENTERPRISE':
        return <Rocket className="w-8 h-8 text-purple-600" />
      default:
        return <Store className="w-8 h-8 text-gray-600" />
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background px-4 py-6">
        <div className="container mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/img/icon.svg" className="w-8 h-8" alt="Racky" />
            <span className="font-bold text-xl">Racky</span>
          </Link>
          <div className="flex items-center gap-4">
            {user ? (
              <Button asChild>
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link to="/login">Sign In</Link>
                </Button>
                <Button asChild>
                  <Link to="/register">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">
            Choose the Perfect Plan for Your Business
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Scale your marketplace management with flexible pricing that grows with your business. 
            Start with instant access to any plan.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <Button
              variant={billingCycle === 'monthly' ? 'default' : 'ghost'}
              onClick={() => setBillingCycle('monthly')}
              className="px-6"
            >
              Monthly
            </Button>
            <Button
              variant={billingCycle === 'yearly' ? 'default' : 'ghost'}
              onClick={() => setBillingCycle('yearly')}
              className="px-6"
            >
              Yearly
              <Badge variant="secondary" className="ml-2 text-xs">
                Save 17%
              </Badge>
            </Button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => (
            <Card 
              key={plan.name} 
              className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="px-3 py-1">Most Popular</Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-4">
                  {getPlanIcon(plan.name)}
                </div>
                <CardTitle className="text-2xl">{plan.displayName}</CardTitle>
                <CardDescription className="text-base">{plan.description}</CardDescription>
                
                <div className="mt-6">
                  <div className="text-4xl font-bold">
                    ${billingCycle === 'monthly' 
                      ? formatPrice(plan.monthlyPrice)
                      : formatYearlyPrice(plan.yearlyPrice)
                    }
                  </div>
                  <div className="text-muted-foreground">
                    per month{billingCycle === 'yearly' && ', billed annually'}
                  </div>
                  {billingCycle === 'yearly' && (
                    <div className="text-sm text-green-600 font-medium mt-1">
                      Save ${formatPrice(plan.monthlyPrice * 2)} per year
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Plan Limits */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    What's Included
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-blue-600" />
                      <span>{plan.limits.maxStores} Stores</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-green-600" />
                      <span>{plan.limits.maxProducts.toLocaleString()} Products</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-purple-600" />
                      <span>{plan.limits.maxMarketplaces} Marketplaces</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-orange-600" />
                      <span>{plan.limits.apiCallsPerMonth.toLocaleString()} API calls</span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Features
                  </h4>
                  <div className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <Check 
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                            feature.enabled ? 'text-green-600' : 'text-muted-foreground'
                          }`} 
                        />
                        <div className={feature.enabled ? '' : 'text-muted-foreground'}>
                          <div className="font-medium text-sm">{feature.name}</div>
                          <div className="text-xs text-muted-foreground">{feature.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  className="w-full mt-6" 
                  size="lg"
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => handleGetStarted(plan.name)}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  ) : (
                    <>
                      {user ? 'Upgrade to ' : 'Start with '}{plan.displayName}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-2">Can I change plans anytime?</h3>
              <p className="text-muted-foreground">
                Yes, you can upgrade or downgrade your plan at any time. Changes will be prorated 
                and reflected in your next billing cycle.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">How does billing work?</h3>
              <p className="text-muted-foreground">
                All subscriptions are billed monthly or yearly based on your preference. 
                No credit card required to start.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">What marketplaces do you support?</h3>
              <p className="text-muted-foreground">
                We support Shopify, Amazon, VTEX, MercadoLibre, Facebook Shop, Google Shopping, 
                WooCommerce, and more. Enterprise plans include custom integrations.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Do you offer refunds?</h3>
              <p className="text-muted-foreground">
                Yes, we offer a 30-day money-back guarantee. If you're not satisfied, 
                we'll provide a full refund within the first 30 days.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16 p-8 bg-muted/50 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Ready to Scale Your Marketplace Business?</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Join thousands of businesses already using Racky to manage their multi-channel operations. 
            Start your subscription today and see the difference.
          </p>
          {!user && (
            <Button size="lg" asChild>
              <Link to="/register">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/30 px-4 py-8 mt-16">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>&copy; 2024 Racky. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}