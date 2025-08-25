import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { Link } from "react-router-dom"
import { getCurrentUser } from "@/lib/auth"
import { PricingContent } from "@/components/pricing/pricing-content"

export function Pricing() {
  const user = getCurrentUser()

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
        <PricingContent />

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto mt-16">
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