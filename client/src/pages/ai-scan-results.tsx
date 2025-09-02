import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, 
  Brain, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Package, 
  RefreshCw,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Sparkles
} from 'lucide-react';

interface JobDetails {
  job: {
    id: string;
    name: string;
    status: 'waiting' | 'active' | 'completed' | 'failed';
    data: {
      filters?: {
        marketplace?: string;
        minDescriptionLength?: number;
        maxDescriptionLength?: number;
        createdAfter?: string;
      };
      createdAt: string;
    };
    result?: any;
    progress?: number;
    createdAt: string;
    processedOn?: string;
    finishedOn?: string;
    failedReason?: string;
  };
  batches: Array<{
    id: string;
    status: string;
    batchNumber: number;
    totalBatches: number;
    productCount: number;
    progress?: number;
    result?: any;
    failedReason?: string;
    createdAt: string;
    finishedOn?: string;
  }>;
  products: Array<{
    id: string;
    title: string;
    externalId: string;
    marketplace: string;
    image?: string;
    status: 'pending' | 'processing' | 'optimized' | 'failed';
    optimizedAt?: string;
    failedReason?: string;
    descriptions: {
      original: string;
      current: string;
      aiGenerated?: string;
      aiPrompt?: string;
      wasModified: boolean;
    };
    aiMetadata?: {
      model: string;
      confidence: number;
      prompt: string;
    };
    actions: Array<{
      type: string;
      status: string;
      createdAt: string;
      completedAt?: string;
      metadata?: any;
    }>;
  }>;
  summary: {
    totalProducts: number;
    optimized: number;
    failed: number;
    processing: number;
    pending: number;
  };
}

export function AIScanResultsPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [jobDetails, setJobDetails] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingProducts, setRegeneratingProducts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentWorkspace && jobId) {
      loadJobDetails();
    }
  }, [currentWorkspace, jobId]);

  const loadJobDetails = async () => {
    if (!currentWorkspace || !currentWorkspace._id || !jobId) {
      setError('No workspace selected or job ID missing');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/opportunities/ai/job/${jobId}/details`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': currentWorkspace._id,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load job details: ${response.statusText}`);
      }
      
      const data = await response.json();
      setJobDetails(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job details');
    } finally {
      setLoading(false);
    }
  };

  const acceptSuggestion = async (productId: string) => {
    if (!currentWorkspace || !currentWorkspace._id) return;
    
    try {
      const product = jobDetails?.products.find(p => p.id === productId);
      if (!product?.descriptions.aiGenerated) return;

      const response = await fetch(`/api/products/${productId}/description`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': currentWorkspace._id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: product.descriptions.aiGenerated
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update product description: ${response.statusText}`);
      }

      // Reload job details to reflect the change
      await loadJobDetails();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept suggestion');
    }
  };

  const rejectAndRegenerate = async (productId: string) => {
    if (!currentWorkspace || !currentWorkspace._id) return;
    
    setRegeneratingProducts(prev => new Set(prev).add(productId));
    
    try {
      const response = await fetch(`/api/opportunities/ai/regenerate/${productId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': currentWorkspace._id,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to regenerate suggestion: ${response.statusText}`);
      }

      // Reload job details to show the new suggestion
      await loadJobDetails();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to regenerate suggestion');
    } finally {
      setRegeneratingProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'optimized':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'active':
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-gray-400" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'optimized':
        return <Badge variant="default" className="bg-green-100 text-green-800">Optimized</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'active':
      case 'processing':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Processing</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-gray-100 text-gray-600">Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          <Brain className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold">AI Scan Results</h1>
        </div>
        <Card>
          <CardContent className="py-10">
            <div className="text-center">
              <Clock className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-600" />
              <p className="text-muted-foreground">Loading job details...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !jobDetails) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/ai-optimization">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to AI Optimization
            </Link>
          </Button>
        </div>
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Job details not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/ai-optimization">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to AI Optimization
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold">AI Scan Results</h1>
          </div>
        </div>
        <Button variant="outline" onClick={loadJobDetails} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Job Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {getStatusIcon(jobDetails.job.status)}
              Job Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getStatusBadge(jobDetails.job.status)}
              {jobDetails.job.status === 'active' && jobDetails.job.progress && (
                <Progress value={jobDetails.job.progress} className="h-2" />
              )}
              <p className="text-xs text-muted-foreground">
                Started: {new Date(jobDetails.job.createdAt).toLocaleString()}
              </p>
              {jobDetails.job.finishedOn && (
                <p className="text-xs text-muted-foreground">
                  Completed: {new Date(jobDetails.job.finishedOn).toLocaleString()}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Total:</span>
                <Badge variant="outline">{jobDetails.summary.totalProducts}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Optimized:</span>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  {jobDetails.summary.optimized}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Processing:</span>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {jobDetails.summary.processing}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Pending:</span>
                <Badge variant="outline" className="bg-gray-100 text-gray-600">
                  {jobDetails.summary.pending}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Failed:</span>
                <Badge variant="destructive">{jobDetails.summary.failed}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Scan Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {jobDetails.job.data.filters?.marketplace && (
                <Badge variant="outline">{jobDetails.job.data.filters.marketplace}</Badge>
              )}
              {jobDetails.job.data.filters?.minDescriptionLength && (
                <Badge variant="outline">Min: {jobDetails.job.data.filters.minDescriptionLength}</Badge>
              )}
              {jobDetails.job.data.filters?.maxDescriptionLength && (
                <Badge variant="outline">Max: {jobDetails.job.data.filters.maxDescriptionLength}</Badge>
              )}
              {jobDetails.job.data.filters?.createdAfter && (
                <Badge variant="outline">
                  After: {new Date(jobDetails.job.data.filters.createdAfter).toLocaleDateString()}
                </Badge>
              )}
              {(!jobDetails.job.data.filters || Object.keys(jobDetails.job.data.filters).length === 0) && (
                <Badge variant="outline" className="text-muted-foreground">No filters applied</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Optimization Results</CardTitle>
          <CardDescription>
            Review AI-generated suggestions for each product and accept or regenerate them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Image</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Description</TableHead>
                <TableHead>AI Prompt / Generated Description</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobDetails.products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    {product.image ? (
                      <img 
                        src={product.image} 
                        alt={product.title}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                        <Package className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{product.title}</p>
                      <p className="text-xs text-muted-foreground">{product.externalId}</p>
                      <Badge variant="outline" className="mt-1">{product.marketplace}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(product.status)}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      <Textarea 
                        value={product.descriptions.current || 'No description'}
                        readOnly
                        className="min-h-[60px] resize-none text-sm"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      {product.status === 'optimized' && product.descriptions.aiGenerated ? (
                        // Show generated description for completed products
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-green-600">✓ AI Generated:</div>
                          <Textarea 
                            value={product.descriptions.aiGenerated}
                            readOnly
                            className="min-h-[60px] resize-none text-sm border-green-200 bg-green-50"
                          />
                        </div>
                      ) : product.descriptions.aiPrompt || product.aiMetadata?.prompt ? (
                        // Show AI prompt for pending/processing products
                        <div className="space-y-2">
                          <div className="text-xs font-medium text-blue-600">
                            {product.status === 'processing' ? '⏳ Processing with prompt:' : '💭 AI Prompt:'}
                          </div>
                          <Textarea 
                            value={product.descriptions.aiPrompt || product.aiMetadata?.prompt || ''}
                            readOnly
                            className="min-h-[60px] resize-none text-sm border-blue-200 bg-blue-50 italic"
                          />
                        </div>
                      ) : (
                        // Show status message for failed or unknown states
                        <div className="text-sm text-muted-foreground p-2 border rounded">
                          {product.status === 'failed' 
                            ? (product.failedReason || 'Generation failed')
                            : product.status === 'pending'
                            ? 'Waiting to be processed...'
                            : 'No AI data available'
                          }
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {product.status === 'optimized' && product.descriptions.aiGenerated ? (
                      <div className="flex flex-col gap-1">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => acceptSuggestion(product.id)}
                          className="w-full"
                        >
                          <ThumbsUp className="h-3 w-3 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectAndRegenerate(product.id)}
                          disabled={regeneratingProducts.has(product.id)}
                          className="w-full"
                        >
                          {regeneratingProducts.has(product.id) ? (
                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Sparkles className="h-3 w-3 mr-1" />
                          )}
                          Regenerate
                        </Button>
                      </div>
                    ) : product.status === 'processing' ? (
                      <div className="text-center">
                        <div className="text-xs text-blue-600 font-medium">Processing...</div>
                        <div className="animate-pulse h-2 w-2 rounded-full bg-blue-400 mx-auto mt-1"></div>
                      </div>
                    ) : product.status === 'pending' ? (
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Waiting in queue</div>
                      </div>
                    ) : product.status === 'failed' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => rejectAndRegenerate(product.id)}
                        disabled={regeneratingProducts.has(product.id)}
                        className="w-full"
                      >
                        {regeneratingProducts.has(product.id) ? (
                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Retry
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {jobDetails.products.length === 0 && (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No products found for this scan.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}