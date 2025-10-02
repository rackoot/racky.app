import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserCheck, Crown, Zap, Mail, ArrowRight, Info, Tag, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCurrentUser } from "@/lib/auth";
import { EmbeddedCheckoutWrapper } from "./embedded-checkout";
import { Plan, ContributorType } from "@/types/plan";
import { couponsApi, CouponData } from "@/api/coupons";
import {
  contributorPlans,
  formatPrice,
  calculateTotalPrice,
  calculateTotalActions,
} from "@/common/data/contributor-data";


interface ContributorSelectorProps {
  showHeader?: boolean;
  title?: string;
  description?: string;
  onSubscriptionComplete?: () => void;
  isReactivation?: boolean;
}

export function ContributorSelector({
  showHeader = true,
  title = "Hire AI Contributors for Your Marketplace",
  description = "Choose the right contributors to automate your marketplace operations. Each contributor performs actions on your behalf.",
  onSubscriptionComplete,
  isReactivation = false,
}: ContributorSelectorProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [contributorCount, setContributorCount] = useState([1]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [showCouponInput, setShowCouponInput] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<CouponData | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const navigate = useNavigate();
  const user = getCurrentUser();


  const getContributorIcon = (type: ContributorType) => {
    switch (type) {
      case "JUNIOR":
        return <Zap className="w-8 h-8 text-blue-600" />;
      case "SENIOR":
        return <UserCheck className="w-8 h-8 text-green-600" />;
      case "EXECUTIVE":
        return <Crown className="w-8 h-8 text-purple-600" />;
    }
  };

  const handlePlanSelect = (plan: Plan) => {
    if (plan.isContactSalesOnly) {
      // Handle Executive plan - redirect to Monday.com form
      window.open(
        "https://forms.monday.com/forms/226e77aa9d94bc45ae4ec3dd8518b5c0?r=use1",
        "_blank"
      );
      return;
    }

    setSelectedPlan(plan);
    setContributorCount([1]); // Reset to 1 contributor
  };

  const handleHireContributors = async () => {
    if (!selectedPlan || !user) {
      navigate("/register");
      return;
    }

    setShowCheckout(true);
  };

  const handleCheckoutSuccess = () => {
    // Call the completion callback if provided (for reactivation)
    if (onSubscriptionComplete) {
      onSubscriptionComplete();
    } else {
      // Redirect to dashboard with success message
      navigate(
        "/dashboard?checkout=success&plan=" + selectedPlan?.contributorType
      );
    }
  };

  const handleCheckoutBack = () => {
    setShowCheckout(false);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }

    setIsValidatingCoupon(true);
    setCouponError(null);

    try {
      const response = await couponsApi.validateCoupon(couponCode.trim());

      if (response.valid && response.data) {
        setAppliedCoupon(response.data);
        setCouponError(null);
      } else {
        setAppliedCoupon(null);
        setCouponError(response.message || "Invalid coupon code");
      }
    } catch (error: any) {
      setAppliedCoupon(null);
      setCouponError(error.message || "Failed to validate coupon");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  };

  const calculateDiscountedPrice = (originalPrice: number): { discountedPrice: number; discountAmount: number } => {
    if (!appliedCoupon) {
      return { discountedPrice: originalPrice, discountAmount: 0 };
    }

    let discountAmount = 0;
    if (appliedCoupon.type === 'percent') {
      discountAmount = (originalPrice * appliedCoupon.value) / 100;
    } else {
      // Amount discount is in cents
      discountAmount = appliedCoupon.value / 100;
    }

    return {
      discountedPrice: Math.max(0, originalPrice - discountAmount),
      discountAmount
    };
  };

  // Show checkout if user has selected plan and clicked hire
  if (showCheckout && selectedPlan && user) {
    return (
      <EmbeddedCheckoutWrapper
        contributorType={selectedPlan.contributorType}
        contributorCount={contributorCount[0]}
        couponCode={appliedCoupon ? appliedCoupon.id : undefined}
        onBack={handleCheckoutBack}
        onSuccess={handleCheckoutSuccess}
        isReactivation={isReactivation}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      {showHeader && (
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">{title}</h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            {description}
          </p>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        {/* Left Column - Plan Selection and Configuration */}
        <div className="lg:col-span-7 space-y-6">
          {/* Contributor Type Cards - Compact Vertical Layout */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold mb-4">
              Choose Your Contributor Type
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contributorPlans.map((plan) => (
                <Card
                  key={plan.contributorType}
                  className={`relative cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    selectedPlan?.contributorType === plan.contributorType
                      ? "ring-2 ring-primary shadow-lg"
                      : ""
                  } ${
                    plan.contributorType === "SENIOR" ? "border-primary" : ""
                  }`}
                  onClick={() => handlePlanSelect(plan)}
                >
                  {plan.contributorType === "SENIOR" && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="px-3 py-1">Most Popular</Badge>
                    </div>
                  )}

                  <CardHeader className="text-center pb-2">
                    <div className="flex justify-center mb-2">
                      {getContributorIcon(plan.contributorType)}
                    </div>
                    <CardTitle className="text-lg">
                      {plan.displayName}
                    </CardTitle>
                    <div className="mt-3">
                      <div className="text-2xl font-bold">
                        {plan.isContactSalesOnly
                          ? "Custom"
                          : `$${formatPrice(plan.monthlyPrice)}`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {plan.isContactSalesOnly
                          ? "Contact for pricing"
                          : "per contributor/month"}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {plan.isContactSalesOnly ? (
                      <Button className="w-full" size="sm">
                        <Mail className="w-4 h-4 mr-2" />
                        Get in Touch
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        size="sm"
                        variant={
                          selectedPlan?.contributorType === plan.contributorType
                            ? "default"
                            : "outline"
                        }
                      >
                        Select {plan.displayName}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Dynamic Content Area - Explanatory Text or Slider */}
          <div className="space-y-6">
            {!selectedPlan || selectedPlan.isContactSalesOnly ? (
              /* Explanatory Text */
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Info className="w-5 h-5" />
                    <p className="text-lg">
                      When you select a contributor type, you'll be able to
                      choose how many to hire.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Contributor Count Selector */
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getContributorIcon(selectedPlan.contributorType)}
                    Configure Your {selectedPlan.displayName}s
                  </CardTitle>
                  <CardDescription>
                    Choose how many {selectedPlan.displayName.toLowerCase()}s
                    you want to hire
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Slider */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium">
                        Number of Contributors
                      </label>
                      <span className="text-2xl font-bold">
                        {contributorCount[0]}
                      </span>
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
                      <span>
                        {selectedPlan.maxContributorsPerWorkspace} contributors
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Coupon Code Section */}
          {selectedPlan && !selectedPlan.isContactSalesOnly && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Have a coupon code?</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCouponInput(!showCouponInput)}
                  >
                    {showCouponInput ? "Hide" : "Show"}
                  </Button>
                </div>
              </CardHeader>
              {showCouponInput && (
                <CardContent className="space-y-3">
                  {!appliedCoupon ? (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="couponCode">Coupon Code</Label>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                              id="couponCode"
                              placeholder="Enter coupon code"
                              value={couponCode}
                              onChange={(e) => {
                                setCouponCode(e.target.value.toUpperCase());
                                setCouponError(null);
                              }}
                              className="pl-9"
                              disabled={isValidatingCoupon}
                            />
                          </div>
                          <Button
                            onClick={handleApplyCoupon}
                            disabled={!couponCode.trim() || isValidatingCoupon}
                            size="default"
                          >
                            {isValidatingCoupon ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Validating...
                              </>
                            ) : (
                              "Apply"
                            )}
                          </Button>
                        </div>
                        {couponError && (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{couponError}</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <Alert className="bg-green-50 border-green-200">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          <div className="flex items-center justify-between">
                            <div>
                              <strong>{appliedCoupon.id}</strong> applied successfully!
                              <div className="text-sm mt-1">
                                {appliedCoupon.type === 'percent' ? (
                                  <span>{appliedCoupon.value}% discount</span>
                                ) : (
                                  <span>${(appliedCoupon.value / 100).toFixed(2)} discount</span>
                                )}
                                {' • '}
                                {appliedCoupon.duration === 'forever' && 'Forever'}
                                {appliedCoupon.duration === 'once' && 'One-time'}
                                {appliedCoupon.duration === 'repeating' && `${appliedCoupon.durationInMonths} months`}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleRemoveCoupon}
                            >
                              Remove
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}

          {/* Purchase Summary */}
          {selectedPlan && !selectedPlan.isContactSalesOnly && (
            <Card>
              <CardHeader>
                <CardTitle>Purchase Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Price per contributor:
                    </span>
                    <span className="font-medium">
                      ${calculateTotalPrice(selectedPlan, 1).perContributor}
                      /month
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Number of contributors:
                    </span>
                    <span className="font-medium">{contributorCount[0]}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Total monthly actions:
                    </span>
                    <span className="font-medium">
                      {calculateTotalActions(selectedPlan, contributorCount[0])}
                    </span>
                  </div>
                  <div className="border-t pt-3 flex justify-between items-center">
                    <span className="text-lg font-semibold">
                      Subtotal:
                    </span>
                    <span className={`text-lg font-semibold ${appliedCoupon ? 'line-through text-muted-foreground' : 'text-primary'}`}>
                      $
                      {
                        calculateTotalPrice(selectedPlan, contributorCount[0])
                          .total
                      }
                    </span>
                  </div>
                  {appliedCoupon && (() => {
                    const originalPrice = calculateTotalPrice(selectedPlan, contributorCount[0]).total;
                    const { discountedPrice, discountAmount } = calculateDiscountedPrice(originalPrice);
                    return (
                      <>
                        <div className="flex justify-between items-center text-green-600">
                          <span className="text-sm font-medium">
                            Discount ({appliedCoupon.type === 'percent' ? `${appliedCoupon.value}%` : `$${(appliedCoupon.value / 100).toFixed(2)}`}):
                          </span>
                          <span className="font-semibold">
                            -${discountAmount.toFixed(2)}
                          </span>
                        </div>
                        <div className="border-t pt-3 flex justify-between items-center">
                          <span className="text-lg font-semibold">
                            Total Monthly Cost:
                          </span>
                          <span className="text-2xl font-bold text-primary">
                            ${discountedPrice.toFixed(2)}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                  {!appliedCoupon && (
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="text-lg font-semibold">
                        Total Monthly Cost:
                      </span>
                      <span className="text-2xl font-bold text-primary">
                        $
                        {
                          calculateTotalPrice(selectedPlan, contributorCount[0])
                            .total
                        }
                      </span>
                    </div>
                  )}
                </div>

                {/* Proceed to Purchase Button */}
                <Button
                  className="w-full mt-4"
                  size="lg"
                  onClick={handleHireContributors}
                >
                  Proceed to Purchase
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Plan Details */}
        <div className="lg:col-span-3">
          <div className="lg:pt-12">
            {selectedPlan ? (
              <Card className="sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getContributorIcon(selectedPlan.contributorType)}
                    {selectedPlan.displayName}
                  </CardTitle>
                  <CardDescription>{selectedPlan.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">
                      Features included:
                    </h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {selectedPlan.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                          <div className="text-sm">
                            <span className="font-medium">{feature.name}</span>
                            <div className="text-muted-foreground text-xs">
                              {feature.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="sticky top-4">
                <CardContent className="p-6">
                  <div className="text-center text-muted-foreground">
                    <div className="w-12 h-12 mx-auto mb-3 bg-muted rounded-full flex items-center justify-center">
                      <Info className="w-6 h-6" />
                    </div>
                    <p className="text-sm">
                      Select a contributor type to see detailed features and
                      pricing information.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
