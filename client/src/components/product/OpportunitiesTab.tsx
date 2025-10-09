import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  RefreshCw, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  TrendingUp,
  Package,
  DollarSign,
  FileText,
  Camera,
  Search,
  Megaphone,
  Store,
  Loader2,
  X,
  PlayCircle
} from "lucide-react";
import { opportunitiesApi, type Opportunity, type OpportunityResponse } from "@/api";
import type { ProductDetail } from "@/types/product";

interface OpportunitiesTabProps {
  product: ProductDetail;
}

const categoryIcons: Record<string, any> = {
  pricing: DollarSign,
  description: FileText,
  images: Camera,
  seo: Search,
  inventory: Package,
  marketing: Megaphone,
  unconnected_marketplaces: TrendingUp,
  // Marketplace icons (fallback to Store)
  shopify: Store,
  vtex: Store,
  mercadolibre: Store,
  amazon: Store,
  facebook_shop: Store,
  google_shopping: Store,
  woocommerce: Store,
};

const priorityOrder = ['critical', 'high', 'medium', 'low'];

export function OpportunitiesTab({ product }: OpportunitiesTabProps) {
  const [opportunities, setOpportunities] = useState<OpportunityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    loadOpportunities();
  }, [product._id]);

  const loadOpportunities = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await opportunitiesApi.getProductOpportunities(product._id);
      setOpportunities(data);
      
      // If no opportunities exist, generate them automatically
      if (data.totalCount === 0) {
        await generateOpportunities(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load opportunities");
    } finally {
      setLoading(false);
    }
  };

  const generateOpportunities = async (forceRefresh: boolean) => {
    setGenerating(true);
    setError("");

    try {
      const data = await opportunitiesApi.generateOpportunities(product._id, forceRefresh);
      
      // Calculate available marketplace tabs from the opportunities
      const availableMarketplaceTabs = new Set<string>();
      availableMarketplaceTabs.add(product.marketplace); // Always include current marketplace
      
      // Add marketplaces mentioned in opportunities
      Object.values(data.opportunities).forEach(categoryOpps => {
        categoryOpps.forEach(opp => {
          if (opp.marketplace) {
            availableMarketplaceTabs.add(opp.marketplace);
          }
        });
      });
      
      // Convert generated response to OpportunityResponse format
      const formattedData: OpportunityResponse = {
        opportunities: data.opportunities,
        categoryCounts: data.categoryCounts,
        availableMarketplaceTabs: Array.from(availableMarketplaceTabs),
        totalCount: data.totalCount,
        productMarketplace: product.marketplace,
        cached: data.cached,
        lastGenerated: data.generatedAt
      };
      
      console.log("Setting new opportunities data:", formattedData);
      setOpportunities(formattedData);
      
      // Reset selected category to 'all' to show new results
      setSelectedCategory("all");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate opportunities");
    } finally {
      setGenerating(false);
    }
  };

  const updateOpportunityStatus = async (opportunityId: string, newStatus: Opportunity['status']) => {
    try {
      await opportunitiesApi.updateOpportunityStatus(opportunityId, newStatus);
      
      // Reload opportunities to reflect status change
      await loadOpportunities();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update opportunity");
    }
  };

  const getFilteredOpportunities = () => {
    if (!opportunities || !opportunities.opportunities) return [];

    let allOpportunities: Opportunity[] = [];
    
    try {
      if (selectedCategory === "all") {
        // Show all opportunities
        Object.values(opportunities.opportunities).forEach(categoryOpps => {
          if (Array.isArray(categoryOpps)) {
            allOpportunities.push(...categoryOpps);
          }
        });
      } else {
        // Show opportunities for selected category
        const categoryOpps = opportunities.opportunities[selectedCategory];
        if (Array.isArray(categoryOpps)) {
          allOpportunities = categoryOpps;
        }
      }

      // Sort by priority
      return allOpportunities.sort((a, b) => {
        const aPriorityIndex = priorityOrder.indexOf(a.priority);
        const bPriorityIndex = priorityOrder.indexOf(b.priority);
        return aPriorityIndex - bPriorityIndex;
      });
    } catch (error) {
      console.error("Error filtering opportunities:", error, opportunities);
      return [];
    }
  };

  const getAvailableCategories = () => {
    if (!opportunities || !opportunities.categoryCounts) return [];

    try {
      const categories = [
        { id: "all", name: "All", count: opportunities.totalCount || 0 }
      ];

      Object.entries(opportunities.categoryCounts).forEach(([categoryId, count]) => {
        categories.push({
          id: categoryId,
          name: opportunitiesApi.formatCategoryName(categoryId),
          count
        });
      });

      return categories;
    } catch (error) {
      console.error("Error getting available categories:", error, opportunities);
      return [{ id: "all", name: "All", count: 0 }];
    }
  };

  const renderOpportunityCard = (opportunity: Opportunity) => {
    const IconComponent = categoryIcons[opportunity.category] || Lightbulb;
    const priorityColor = opportunitiesApi.getPriorityColor(opportunity.priority);
    const statusColor = opportunitiesApi.getStatusColor(opportunity.status);

    return (
      <Card key={opportunity._id} className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${priorityColor}`}>
                <IconComponent className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg leading-tight">{opportunity.title}</CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className={priorityColor}>
                    {opportunity.priority}
                  </Badge>
                  <Badge variant="secondary" className={statusColor}>
                    {opportunity.status.replace('_', ' ')}
                  </Badge>
                  {opportunity.marketplace && (
                    <Badge variant="outline" className="text-gray-600 bg-gray-100">
                      {opportunity.marketplace}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {opportunity.potentialImpact.percentage > 0 && (
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  +{opportunity.potentialImpact.percentage}%
                </div>
                <div className="text-sm text-muted-foreground">potential impact</div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            {opportunity.description}
          </p>
          
          {/* {opportunity.actionRequired && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <h4 className="font-medium text-blue-800 mb-1">Action Required:</h4>
              <p className="text-sm text-blue-700">{opportunity.actionRequired}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {opportunity.status === 'open' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => updateOpportunityStatus(opportunity._id, 'in_progress')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <PlayCircle className="w-4 h-4 mr-1" />
                    Start
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateOpportunityStatus(opportunity._id, 'dismissed')}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Dismiss
                  </Button>
                </>
              )}
              
              {opportunity.status === 'in_progress' && (
                <>
                  <Button
                    size="sm"
                    onClick={() => updateOpportunityStatus(opportunity._id, 'completed')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Complete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => updateOpportunityStatus(opportunity._id, 'open')}
                  >
                    Revert
                  </Button>
                </>
              )}
              
              {opportunity.status === 'completed' && (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Completed
                </Badge>
              )}
            </div>
            
            {opportunity.aiMetadata?.confidence && (
              <div className="text-xs text-muted-foreground">
                AI Confidence: {Math.round(opportunity.aiMetadata.confidence * 100)}%
              </div>
            )}
          </div> */}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const filteredOpportunities = getFilteredOpportunities();
  const availableCategories = getAvailableCategories();

  return (
    <div className="space-y-6">
      {/* Header with Generate Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI-Powered Opportunities</h2>
          <p className="text-muted-foreground">
            Discover ways to improve your product performance and sales
          </p>
        </div>
        <Button
          onClick={() => generateOpportunities(true)}
          disabled={generating}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          {generating ? 'Generating...' : 'Refresh Suggestions'}
        </Button>
      </div>

      {opportunities && opportunities.totalCount > 0 && (
        <>
          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {availableCategories.map(category => (
              <Button
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(category.id)}
                className="h-8"
              >
                {category.name}
                <Badge variant="secondary" className="ml-2 h-5">
                  {category.count}
                </Badge>
              </Button>
            ))}
          </div>

          {/* Cache Status */}
          {opportunities.cached && opportunities.lastGenerated && (
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Showing cached suggestions from {new Date(opportunities.lastGenerated).toLocaleString()}.
                Click "Refresh Suggestions" to generate new ones.
              </AlertDescription>
            </Alert>
          )}

          {/* Opportunities Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredOpportunities.map(renderOpportunityCard)}
          </div>

          {filteredOpportunities.length === 0 && selectedCategory !== "all" && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Lightbulb className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No opportunities in this category</h3>
                <p className="text-muted-foreground text-center">
                  Try selecting "All" or generate fresh suggestions.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Empty State */}
      {(!opportunities || opportunities.totalCount === 0) && !generating && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lightbulb className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No opportunities found</h3>
            <p className="text-muted-foreground text-center mb-6">
              Generate AI-powered suggestions to improve your product performance and discover new growth opportunities.
            </p>
            <Button
              onClick={() => generateOpportunities(false)}
              disabled={generating}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {generating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Lightbulb className="w-4 h-4 mr-2" />
              )}
              Generate Opportunities
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}