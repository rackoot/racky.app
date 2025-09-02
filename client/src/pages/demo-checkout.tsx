import { useState, useEffect } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, CreditCard, Lock } from "lucide-react"
import { getAuthHeaders } from "@/lib/utils"
import { demoApi } from "@/api"

export function DemoCheckout() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [processing, setProcessing] = useState(false)
  const [plan, setPlan] = useState("")
  const [billingCycle, setBillingCycle] = useState("")

  useEffect(() => {
    setPlan(searchParams.get('plan') || '')
    setBillingCycle(searchParams.get('billing') || 'monthly')
  }, [searchParams])

  const handlePayment = async () => {
    setProcessing(true)
    
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    try {
      // In demo mode, we'll simulate successful payment by upgrading the user
      await demoApi.upgradeSubscription({
        planName: plan
      })
      
      // Redirect to success page
      navigate('/subscription?success=true&demo=true')
    } catch (error) {
      console.error('Demo upgrade failed:', error)
      // Fallback to subscription page
      navigate('/subscription')
    }
  }

  const getPlanPrice = () => {
    const prices = {
      BASIC: billingCycle === 'yearly' ? '$290/year' : '$29/month',
      PRO: billingCycle === 'yearly' ? '$790/year' : '$79/month', 
      ENTERPRISE: billingCycle === 'yearly' ? '$1990/year' : '$199/month'
    }
    return prices[plan as keyof typeof prices] || '$0'
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Lock className="w-5 h-5" />
            Demo Checkout
          </CardTitle>
          <CardDescription>
            This is a demo payment page. No real charges will be made.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Plan Summary */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h3 className="font-semibold">{plan} Plan</h3>
            <p className="text-sm text-muted-foreground">
              {billingCycle === 'yearly' ? 'Billed annually' : 'Billed monthly'}
            </p>
            <p className="text-xl font-bold mt-2">{getPlanPrice()}</p>
          </div>

          {/* Mock Payment Form */}
          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="w-5 h-5" />
                <span className="font-medium">Payment Method</span>
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
                    This is a demonstration. Your subscription will be activated without any real payment.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              className="w-full" 
              onClick={handlePayment}
              disabled={processing}
            >
              {processing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
                  Processing Demo Payment...
                </>
              ) : (
                <>Complete Demo Payment - {getPlanPrice()}</>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/pricing')}
              disabled={processing}
            >
              Back to Pricing
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            🔒 This is a demo environment. No real payment will be processed.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}