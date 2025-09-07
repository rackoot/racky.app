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
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
  Maximize2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const [acceptingAll, setAcceptingAll] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PRODUCTS_PER_PAGE = 5;
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDescription, setModalDescription] = useState('');

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

      const response = await fetch(`/api/products/${productId}/description/accept`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': currentWorkspace._id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: product.descriptions.aiGenerated,
          marketplace: product.marketplace
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to accept suggestion: ${response.statusText}`);
      }

      // Update product status to pending locally
      setJobDetails(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          products: prev.products.map(p => 
            p.id === productId 
              ? { ...p, status: 'updating', updateStatus: 'pending' as any }
              : p
          )
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept suggestion');
    }
  };

  const acceptAllCurrentPage = async () => {
    if (!currentWorkspace || !currentWorkspace._id || !jobDetails) return;
    
    setAcceptingAll(true);
    try {
      const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
      const endIndex = startIndex + PRODUCTS_PER_PAGE;
      const currentPageProducts = jobDetails.products.slice(startIndex, endIndex);
      const optimizedProducts = currentPageProducts.filter(
        p => p.status === 'optimized' && p.descriptions.aiGenerated
      );

      if (optimizedProducts.length === 0) {
        setError('No optimized products to accept on current page');
        return;
      }

      const response = await fetch(`/api/products/accept-all-descriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': currentWorkspace._id,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: optimizedProducts.map(p => ({
            productId: p.id,
            description: p.descriptions.aiGenerated,
            marketplace: p.marketplace
          }))
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to accept all descriptions: ${response.statusText}`);
      }

      // Update product statuses to pending locally
      setJobDetails(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          products: prev.products.map(p => 
            optimizedProducts.some(op => op.id === p.id)
              ? { ...p, status: 'updating', updateStatus: 'pending' as any }
              : p
          )
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept all descriptions');
    } finally {
      setAcceptingAll(false);
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
            <Link to="/ai-optimization/scan-history">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Scan History
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
            <Link to="/ai-optimization/scan-history">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Scan History
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product Optimization Results</CardTitle>
              <CardDescription>
                Review AI-generated suggestions for each product and accept or regenerate them.
              </CardDescription>
            </div>
            {jobDetails && (() => {
              const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
              const endIndex = startIndex + PRODUCTS_PER_PAGE;
              const currentPageProducts = jobDetails.products.slice(startIndex, endIndex);
              const optimizedProducts = currentPageProducts.filter(p => p.status === 'optimized' && p.descriptions.aiGenerated);
              return optimizedProducts.length > 0 ? (
                <Button 
                  onClick={acceptAllCurrentPage}
                  disabled={acceptingAll}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {acceptingAll ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCheck className="h-4 w-4 mr-2" />
                  )}
                  Accept All ({optimizedProducts.length} products)
                </Button>
              ) : null;
            })()}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Image</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Description</TableHead>
                <TableHead>Generated Description</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE;
                const endIndex = startIndex + PRODUCTS_PER_PAGE;
                const currentPageProducts = jobDetails.products.slice(startIndex, endIndex);
                return currentPageProducts.map((product) => (
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
                    {(product as any).updateStatus === 'pending' ? (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Queued for Update</Badge>
                    ) : getStatusBadge(product.status)}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      <div className="relative">
                        <Textarea 
                          value={product.descriptions.current || 'No description'}
                          readOnly
                          className="min-h-[120px] resize-none text-sm pr-10"
                          rows={6}
                        />
                        {product.descriptions.current && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-gray-100"
                            onClick={() => {
                              setModalDescription(product.descriptions.current || 'No description');
                              setModalOpen(true);
                            }}
                          >
                            <Maximize2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      {product.status === 'optimized' && product.descriptions.aiGenerated ? (
                        // Show generated description for completed products
                        <div className="space-y-2">
                          <div className="relative">
                            <Textarea 
                              value={product.descriptions.aiGenerated}
                              readOnly
                              className="min-h-[120px] resize-none text-sm border-green-200 bg-green-50 pr-10"
                              rows={6}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-green-100"
                              onClick={() => {
                                setModalDescription(product.descriptions.aiGenerated || '');
                                setModalOpen(true);
                              }}
                            >
                              <Maximize2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ) : (product as any).status === 'updating' || (product as any).updateStatus === 'pending' ? (
                        <div className="text-sm text-yellow-600 p-2 border border-yellow-200 bg-yellow-50 rounded min-h-[120px] flex items-center justify-center">
                          ⏳ Queued for marketplace update...
                        </div>
                      ) : (
                        // Show status message for pending, processing, or failed states
                        <div className="text-sm text-muted-foreground p-2 border rounded min-h-[120px] flex items-center justify-center">
                          {product.status === 'processing' 
                            ? '⏳ Generating description...'
                            : product.status === 'failed' 
                            ? `❌ ${product.failedReason || 'Generation failed'}`
                            : product.status === 'pending'
                            ? '⏱️ Waiting to be processed...'
                            : 'No description generated yet'
                          }
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(product as any).status === 'updating' || (product as any).updateStatus === 'pending' ? (
                      <div className="text-center">
                        <div className="text-xs text-yellow-600 font-medium">Queued for Update</div>
                        <div className="animate-pulse h-2 w-2 rounded-full bg-yellow-400 mx-auto mt-1"></div>
                      </div>
                    ) : product.status === 'optimized' && product.descriptions.aiGenerated ? (
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
              ))
              })()}
            </TableBody>
          </Table>

          {/* Pagination */}
          {jobDetails.products.length > PRODUCTS_PER_PAGE && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min((currentPage - 1) * PRODUCTS_PER_PAGE + 1, jobDetails.products.length)} to{' '}
                {Math.min(currentPage * PRODUCTS_PER_PAGE, jobDetails.products.length)} of{' '}
                {jobDetails.products.length} products
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.ceil(jobDetails.products.length / PRODUCTS_PER_PAGE) }, (_, i) => {
                    const page = i + 1;
                    if (Math.ceil(jobDetails.products.length / PRODUCTS_PER_PAGE) <= 5) {
                      return (
                        <Button
                          key={`page-${page}`}
                          variant={page === currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    } else {
                      // Show first page, current page +/- 1, and last page with ellipsis
                      if (page === 1 || 
                          page === Math.ceil(jobDetails.products.length / PRODUCTS_PER_PAGE) ||
                          (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <Button
                            key={`page-${page}`}
                            variant={page === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={`ellipsis-${page}`} className="px-2">...</span>;
                      }
                      return null;
                    }
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={currentPage >= Math.ceil(jobDetails.products.length / PRODUCTS_PER_PAGE)}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {jobDetails.products.length === 0 && (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No products found for this scan.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Description Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Full Description</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <Textarea
              value={modalDescription}
              readOnly
              className="min-h-[400px] resize-none text-sm"
              rows={20}
            />
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={() => setModalOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}