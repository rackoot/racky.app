import React, { useState, useEffect } from "react"
import { loadStripe } from "@stripe/stripe-js"
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CreditCard, ArrowLeft, Loader2 } from "lucide-react"
import { billingApi } from "@/api"

interface EmbeddedCheckoutProps {
  contributorType: string
  contributorCount: number
  onBack: () => void
  onSuccess?: () => void
  isReactivation?: boolean
}

// Initialize Stripe (you'll need to add your publishable key)
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_...')

export function EmbeddedCheckoutWrapper({ 
  contributorType, 
  contributorCount, 
  onBack, 
  onSuccess,
  isReactivation = false
}: EmbeddedCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>("")

  useEffect(() => {
    createCheckoutSession()
  }, [contributorType, contributorCount])

  const createCheckoutSession = async () => {
    setLoading(true)
    setError("")

    try {
      const data = await billingApi.createCheckoutSession({
        contributorType,
        contributorCount: contributorCount,
        successUrl: window.location.origin + '/purchase-success?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: window.location.origin + '/pricing'
      })

      if (data.url) {
        // Redirect to Stripe checkout URL
        window.location.href = data.url
      } else if (data.clientSecret) {
        // For embedded checkout, use the client secret
        setClientSecret(data.clientSecret)
      } else {
        // Set error if we don't have URL or clientSecret
        setError("Failed to create checkout session. Please try again.")
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      setError('Failed to initialize checkout. Please try again.')
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

  if (error) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Checkout Error
          </CardTitle>
          <CardDescription>
            {error}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="p-4 bg-red-50 dark:bg-red-950/50 rounded-lg">
            <div className="flex items-start gap-2">
              <div className="w-4 h-4 bg-red-600 rounded-full mt-0.5 flex-shrink-0"></div>
              <div className="text-sm">
                <p className="font-medium text-red-900 dark:text-red-100">Payment Setup Failed</p>
                <p className="text-red-700 dark:text-red-200">
                  We couldn't set up your payment. Please try again or contact support if the problem persists.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => window.location.href = '/pricing'}
            >
              Back to Pricing
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={createCheckoutSession}
            >
              Try Again
            </Button>
          </div>
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
        <CardContent className="space-y-3">
          <Button
            onClick={() => window.location.href = '/pricing'}
            className="w-full"
          >
            Back to Pricing
          </Button>
          <Button
            onClick={onBack}
            variant="outline"
            className="w-full"
          >
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