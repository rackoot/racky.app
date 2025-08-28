import React, { useState, useEffect } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, CreditCard, ArrowLeft, Loader2 } from "lucide-react"
import { getAuthHeaders } from "@/lib/utils"
import { billingApi } from "@/api"

interface EmbeddedCheckoutProps {
  planName: string
  contributorCount: number
  billingCycle: 'monthly' | 'yearly'
  onBack: () => void
  onSuccess?: () => void
}

// Initialize Stripe (you'll need to add your publishable key)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_...')

export function EmbeddedCheckoutWrapper({ 
  planName, 
  contributorCount, 
  billingCycle, 
  onBack, 
  onSuccess 
}: EmbeddedCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")
  const [isProduction, setIsProduction] = useState(false)

  useEffect(() => {
    createCheckoutSession()
  }, [planName, contributorCount, billingCycle])

  const createCheckoutSession = async () => {
    setLoading(true)
    setError("")
    
    try {
      const data = await billingApi.createCheckoutSession({
        planName,
        contributorCount: contributorCount,
        billingCycle: billingCycle,
        successUrl: window.location.origin + '/purchase-success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: window.location.origin + '/pricing'
      })
      
      // Check if this is a production response with real Stripe data
      const isProductionResponse = data.isProduction === true
      setIsProduction(isProductionResponse)
      
      if (data.url) {
        // For both Stripe URLs and development internal URLs, redirect
        window.location.href = data.url
      } else if (data.clientSecret) {
        // For embedded checkout, use the client secret
        setClientSecret(data.clientSecret)
      } else {
        // Only set error if we don't have URL or clientSecret
        setError("Failed to create checkout session")
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      setError('Failed to initialize checkout')
    } finally {
      setLoading(false)
    }
  }

  const embeddedOptions = {
    clientSecret,
    onComplete: () => {
      console.log('Payment completed successfully!')
      onSuccess?.()
    }
  }

  if (loading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Preparing Checkout
          </CardTitle>
          <CardDescription>
            Setting up your payment...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading checkout...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !isProduction) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Demo Checkout
          </CardTitle>
          <CardDescription>
            {error || "Stripe is not configured. This is a development environment."}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Plan Summary */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold">{planName} Plan</h3>
            <p className="text-sm text-muted-foreground">
              {contributorCount} contributor{contributorCount > 1 ? 's' : ''} • {billingCycle === 'yearly' ? 'Billed annually' : 'Billed monthly'}
            </p>
          </div>

          {/* Mock Payment Form */}
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="w-5 h-5" />
                <span className="font-medium">Payment Method (Demo)</span>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div>•••• •••• •••• 4242 (Demo Card)</div>
                <div>Expires: 12/25 • CVC: 123</div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-900 dark:text-blue-100">Demo Mode</p>
                  <p className="text-blue-700 dark:text-blue-200">
                    Stripe is not configured. In production, this would show the real payment form.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              className="w-full" 
              onClick={() => {
                // Simulate successful payment and redirect to purchase-success
                setTimeout(() => {
                  window.location.href = '/purchase-success?demo=true'
                }, 1000)
              }}
            >
              Complete Demo Payment
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={onBack}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Plan Selection
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            🔒 This is a demo environment. No real payment will be processed.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (!clientSecret) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Checkout Error</CardTitle>
          <CardDescription>
            Unable to initialize checkout. Please try again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onBack} variant="outline" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Plan Selection
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Complete Your Purchase
        </CardTitle>
        <CardDescription>
          Secure payment powered by Stripe
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Plan Selection
          </Button>
        </div>

        <EmbeddedCheckoutProvider stripe={stripePromise} options={embeddedOptions}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>

        <p className="text-xs text-center text-muted-foreground">
          🔒 Your payment is secured with 256-bit SSL encryption
        </p>
      </CardContent>
    </Card>
  )
}