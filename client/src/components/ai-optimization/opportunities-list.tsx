import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  MoreHorizontal,
  Archive,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Opportunity {
  _id: string;
  productId: string;
  title: string;
  description: string;
  category: string;
  marketplace: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  potentialImpact: {
    revenue: number;
    percentage: number;
  };
  actionRequired: string;
  status: 'active' | 'completed' | 'dismissed';
  confidence?: number;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
  product?: {
    title: string;
    price: number;
  };
}

interface OpportunitiesListProps {
  className?: string;
}

const PRIORITIES = [
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'low', label: 'Low', color: 'bg-green-500' },
];

const CATEGORIES = [
  'pricing',
  'description',
  'images',
  'seo',
  'inventory',
  'marketing',
  'unconnected_marketplaces',
];

const MARKETPLACES = [
  'shopify',
  'amazon',
  'vtex',
  'mercadolibre',
  'woocommerce',
  'facebook_shop',
  'google_shopping',
];

export const OpportunitiesList: React.FC<OpportunitiesListProps> = ({ className }) => {
  const { currentWorkspace } = useWorkspace();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOpportunities, setSelectedOpportunities] = useState<Set<string>>(new Set());
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const loadOpportunities = async () => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      params.set('limit', pageSize.toString());
      params.set('offset', ((currentPage - 1) * pageSize).toString());
      
      if (searchQuery) params.set('search', searchQuery);
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (categoryFilter) params.set('category', categoryFilter);
      if (marketplaceFilter) params.set('marketplace', marketplaceFilter);
      
      const response = await fetch(`/api/opportunities?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': currentWorkspace._id,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load opportunities: ${response.statusText}`);
      }
      
      const data = await response.json();
      setOpportunities(data.data?.opportunities || []);
      setTotalCount(data.data?.total || 0);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load opportunities');
      console.error('Error loading opportunities:', err);
    } finally {
      setLoading(false);
    }
  };

  // Bulk actions
  const handleBulkAction = async (action: 'complete' | 'dismiss' | 'delete') => {
    if (selectedOpportunities.size === 0) return;
    
    try {
      const opportunityIds = Array.from(selectedOpportunities);
      
      const response = await fetch('/api/opportunities/bulk-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': currentWorkspace!._id,
        },
        body: JSON.stringify({
          opportunityIds,
          action,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to perform bulk action: ${response.statusText}`);
      }
      
      // Reload opportunities
      await loadOpportunities();
      setSelectedOpportunities(new Set());
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform bulk action');
      console.error('Error performing bulk action:', err);
    }
  };

  const toggleOpportunitySelection = (opportunityId: string) => {
    const newSelection = new Set(selectedOpportunities);
    if (newSelection.has(opportunityId)) {
      newSelection.delete(opportunityId);
    } else {
      newSelection.add(opportunityId);
    }
    setSelectedOpportunities(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedOpportunities.size === opportunities.length) {
      setSelectedOpportunities(new Set());
    } else {
      setSelectedOpportunities(new Set(opportunities.map(op => op._id)));
    }
  };

  const getPriorityColor = (priority: string) => {
    return PRIORITIES.find(p => p.value === priority)?.color || 'bg-gray-500';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatImpact = (impact: { revenue: number; percentage: number }) => {
    if (impact.revenue > 0) {
      return `$${impact.revenue.toLocaleString()}`;
    }
    return `${impact.percentage}%`;
  };

  // Load opportunities on mount and when filters change
  useEffect(() => {
    if (currentWorkspace) {
      loadOpportunities();
    }
  }, [currentWorkspace, currentPage, searchQuery, statusFilter, priorityFilter, categoryFilter, marketplaceFilter]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Header with filters */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Optimization Opportunities</h2>
              <p className="text-muted-foreground">
                AI-generated recommendations to improve your products
              </p>
            </div>
            
            {selectedOpportunities.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedOpportunities.size} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('complete')}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Mark Complete
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('dismiss')}
                >
                  <Archive className="h-4 w-4 mr-1" />
                  Dismiss
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('delete')}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search opportunities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Priorities</SelectItem>
                {PRIORITIES.map(priority => (
                  <SelectItem key={priority.value} value={priority.value}>
                    {priority.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {CATEGORIES.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={marketplaceFilter} onValueChange={setMarketplaceFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Marketplace" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Marketplaces</SelectItem>
                {MARKETPLACES.map(marketplace => (
                  <SelectItem key={marketplace} value={marketplace}>
                    {marketplace.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('');
                setPriorityFilter('');
                setCategoryFilter('');
                setMarketplaceFilter('');
              }}
            >
              Clear Filters
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Opportunities Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={opportunities.length > 0 && selectedOpportunities.size === opportunities.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Impact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading opportunities...
                    </TableCell>
                  </TableRow>
                ) : opportunities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <div className="text-center">
                        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold">No opportunities found</h3>
                        <p className="text-muted-foreground">
                          Try adjusting your filters or running an AI scan to generate opportunities
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  opportunities.map((opportunity) => (
                    <TableRow key={opportunity._id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedOpportunities.has(opportunity._id)}
                          onCheckedChange={() => toggleOpportunitySelection(opportunity._id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{opportunity.title}</div>
                          <div className="text-sm text-muted-foreground line-clamp-2">
                            {opportunity.description}
                          </div>
                          {opportunity.aiGenerated && (
                            <Badge variant="secondary" className="text-xs">
                              AI Generated
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">
                            {opportunity.product?.title || 'Product'}
                          </div>
                          {opportunity.product?.price && (
                            <div className="text-sm text-muted-foreground">
                              ${opportunity.product.price}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${getPriorityColor(opportunity.priority)}`} />
                          <span className="capitalize">{opportunity.priority}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {opportunity.category.replace('_', ' ')}
                        </Badge>
                        {opportunity.marketplace && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {opportunity.marketplace}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {formatImpact(opportunity.potentialImpact)}
                        </span>
                        {opportunity.confidence && (
                          <div className="text-xs text-muted-foreground">
                            {Math.round(opportunity.confidence * 100)}% confident
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            opportunity.status === 'active' ? 'default' :
                            opportunity.status === 'completed' ? 'secondary' : 'outline'
                          }
                        >
                          {opportunity.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {formatDate(opportunity.createdAt)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Product
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Mark Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <XCircle className="h-4 w-4 mr-2" />
                              Dismiss
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} opportunities
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};