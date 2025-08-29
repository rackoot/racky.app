import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Brain, Clock, Play, CheckCircle2, XCircle, Filter, Search, Store, Eye, Package, Hash } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SimpleOpportunitiesList } from '@/components/ai-optimization/simple-opportunities-list';
import { marketplaceService } from '@/services/marketplace';
import type { Marketplace } from '@/types/marketplace';

interface AIJob {
  id: string;
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
  progress?: number;
  result?: {
    totalProducts?: number;
    totalBatches?: number;
    message?: string;
  };
  processedOn?: string;
  finishedOn?: string;
  failedReason?: string;
}

interface JobDetails {
  job: AIJob & { name: string };
  batches: Array<{
    id: string;
    status: string;
    batchNumber: number;
    totalBatches: number;
    productCount: number;
    progress?: number;
    result?: any;
    failedReason?: string;
    createdAt: number;
    finishedOn?: number;
  }>;
  products: Array<{
    id: string;
    title: string;
    externalId: string;
    marketplace: string;
    image?: string;
    status: 'pending' | 'optimized' | 'failed';
    optimizedAt?: string;
    descriptions?: {
      original: string;
      current: string;
      wasModified: boolean;
      aiGenerated?: string;
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
    pending: number;
  };
}

const AIOptimizationPage = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [activeJob, setActiveJob] = useState<AIJob | null>(null);
  const [selectedJobDetails, setSelectedJobDetails] = useState<JobDetails | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  // Connected marketplaces
  const [connectedMarketplaces, setConnectedMarketplaces] = useState<Marketplace[]>([]);
  const [marketplacesLoading, setMarketplacesLoading] = useState(false);
  
  // Helper function to check if any scan is active/waiting
  const hasActiveScan = () => {
    return jobs.some(job => job.status === 'waiting' || job.status === 'active');
  };
  
  // Helper function to get marketplace with active/waiting scan
  const getActiveMarketplace = () => {
    const activeJob = jobs.find(job => job.status === 'waiting' || job.status === 'active');
    return activeJob?.data.filters?.marketplace;
  };
  
  // Helper function to get available marketplaces (connected, has products, and not running scans)
  const getAvailableMarketplaces = React.useCallback(() => {
    // Get all marketplaces that have active or waiting scans
    const busyMarketplaces = jobs
      .filter(job => job.status === 'waiting' || job.status === 'active')
      .map(job => job.data.filters?.marketplace)
      .filter(Boolean);
    
    console.log('Busy marketplaces:', busyMarketplaces);
    console.log('Connected marketplaces:', connectedMarketplaces.map(mp => mp.id));
    
    // Return marketplaces that are connected, have products, and not busy
    const available = connectedMarketplaces.filter(mp => 
      !busyMarketplaces.includes(mp.id) && 
      mp.connectionInfo && 
      mp.connectionInfo.productsCount > 0
    );
    console.log('Available marketplaces:', available.map(mp => mp.id));
    return available;
  }, [jobs, connectedMarketplaces]);
  
  // Scan filters
  const [marketplace, setMarketplace] = useState<string>('');
  const [minDescriptionLength, setMinDescriptionLength] = useState<string>('');
  const [maxDescriptionLength, setMaxDescriptionLength] = useState<string>('');
  const [createdAfter, setCreatedAfter] = useState<string>('');

  // Load connected marketplaces
  const loadConnectedMarketplaces = async () => {
    if (!currentWorkspace || !currentWorkspace._id) {
      return;
    }
    
    setMarketplacesLoading(true);
    
    try {
      const marketplaces = await marketplaceService.getMarketplaceStatus();
      // Filter to only connected marketplaces with products
      const connected = marketplaces.filter(m => 
        m.connectionInfo && m.connectionInfo.productsCount > 0
      );
      setConnectedMarketplaces(connected);
      
      // Auto-select first available marketplace if none selected or current selection is unavailable
      const available = connected.filter(mp => mp.id !== getActiveMarketplace());
      if (!marketplace && available.length > 0) {
        setMarketplace(available[0].id);
      } else if (marketplace && !available.find(mp => mp.id === marketplace)) {
        // Reset selection if currently selected marketplace is no longer available
        setMarketplace(available.length > 0 ? available[0].id : '');
      }
    } catch (err) {
      console.error('Error loading connected marketplaces:', err);
      setError('Failed to load connected marketplaces');
    } finally {
      setMarketplacesLoading(false);
    }
  };

  // Load AI jobs
  const loadJobs = async () => {
    if (!currentWorkspace || !currentWorkspace._id) {
      setError('No workspace selected');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/opportunities/ai/jobs', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': currentWorkspace._id,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load AI jobs: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Jobs API response:', data); // Debug log
      setJobs(data.data?.jobs || data.data || []);
      
      // Find active job for monitoring
      const jobsList = data.data?.jobs || data.data || [];
      const active = jobsList.find((job: AIJob) => job.status === 'active');
      if (active) {
        setActiveJob(active);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI jobs');
      console.error('Error loading AI jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch job details
  const fetchJobDetails = async (jobId: string) => {
    if (!currentWorkspace || !currentWorkspace._id) {
      return;
    }

    setDetailsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/opportunities/ai/job/${jobId}/details`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': currentWorkspace._id,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch job details');
      }

      const result = await response.json();
      if (result.success) {
        setSelectedJobDetails(result.data);
        setDetailsModalOpen(true);
      } else {
        setError(result.message || 'Failed to fetch job details');
      }
    } catch (err: any) {
      console.error('Error fetching job details:', err);
      setError('Failed to fetch job details');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Start AI scan
  const startAIScan = async () => {
    console.log('startAIScan called');
    
    if (!currentWorkspace || !currentWorkspace._id) {
      setError('No workspace selected');
      return;
    }
    
    // Prevent multiple calls while already loading
    if (scanLoading) {
      console.log('Scan already in progress, ignoring call');
      return;
    }
    
    // Check if there's already an active or waiting job for this marketplace
    if (hasActiveScan()) {
      const activeMarketplace = getActiveMarketplace();
      if (activeMarketplace === marketplace) {
        setError('This marketplace already has a scan in progress. Please select a different marketplace.');
        return;
      }
    }
    
    // Validate required fields
    if (!marketplace) {
      setError('Please select a marketplace');
      return;
    }
    
    setScanLoading(true);
    setError(null);
    
    try {
      const filters: any = {};
      
      // Marketplace is now required
      filters.marketplace = marketplace;
      if (minDescriptionLength) filters.minDescriptionLength = parseInt(minDescriptionLength);
      if (maxDescriptionLength) filters.maxDescriptionLength = parseInt(maxDescriptionLength);
      if (createdAfter) filters.createdAfter = new Date(createdAfter).toISOString();
      
      const response = await fetch('/api/opportunities/ai/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': currentWorkspace._id,
        },
        body: JSON.stringify(filters),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to start AI scan: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('AI scan started:', data);
      
      // Show success feedback
      setScanSuccess(true);
      setSuccessMessage(data.message || 'AI scan started successfully! Processing products...');
      setError(null);
      
      // Store the marketplace that was used for the scan
      const usedMarketplace = marketplace;
      
      // Clear form
      setMarketplace('');
      setMinDescriptionLength('');
      setMaxDescriptionLength('');
      setCreatedAfter('');
      
      // Reload jobs and marketplaces to ensure form is updated
      console.log('Reloading jobs and marketplaces after scan start...');
      await Promise.all([
        loadJobs(),
        loadConnectedMarketplaces()
      ]);
      
      // Small delay to ensure the new job appears in the backend
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reload jobs again to make sure we have the latest state
      await loadJobs();
      
      // Force a re-evaluation by triggering a state update
      setTimeout(() => {
        const currentlyAvailable = getAvailableMarketplaces();
        console.log(`Final check - Used marketplace: ${usedMarketplace}`);
        console.log('Available marketplaces after final reload:', currentlyAvailable.map(mp => mp.id));
        console.log('Current jobs:', jobs.map(j => ({ id: j.id, status: j.status, marketplace: j.data.filters?.marketplace })));
        
        // If the used marketplace is still showing as available, something went wrong
        if (currentlyAvailable.find(mp => mp.id === usedMarketplace)) {
          console.warn(`WARNING: Marketplace ${usedMarketplace} is still showing as available after starting a scan!`);
        }
      }, 100);
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setScanSuccess(false);
        setSuccessMessage('');
      }, 5000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start AI scan');
      setScanSuccess(false);
      setSuccessMessage('');
      console.error('Error starting AI scan:', err);
    } finally {
      setScanLoading(false);
    }
  };

  // Monitor active job progress
  useEffect(() => {
    if (!activeJob || !currentWorkspace) return;
    
    const pollJobStatus = async () => {
      try {
        const response = await fetch(`/api/opportunities/ai/status/${activeJob.id}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'X-Workspace-ID': currentWorkspace._id,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setActiveJob(prev => prev ? { ...prev, ...data.data } : null);
            
            // If job completed or failed, refresh job list
            if (['completed', 'failed'].includes(data.data.status)) {
              setActiveJob(null);
              loadJobs();
            }
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    };
    
    const interval = setInterval(pollJobStatus, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [activeJob, currentWorkspace]);

  // Load jobs and marketplaces on mount and workspace change
  useEffect(() => {
    if (currentWorkspace) {
      loadJobs();
      loadConnectedMarketplaces();
    }
  }, [currentWorkspace]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'waiting':
        return <Clock className="h-4 w-4" />;
      case 'active':
        return <Play className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'bg-yellow-500';
      case 'active':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Show loading state if no workspace is selected
  if (!currentWorkspace) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              AI Optimization
            </h1>
            <p className="text-muted-foreground mt-1">
              Loading workspace...
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
              <p className="text-muted-foreground">Setting up workspace context...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            AI Optimization
          </h1>
          <p className="text-muted-foreground mt-1">
            Analyze and optimize your products with AI-powered recommendations
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="opportunities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="scan">Start AI Scan</TabsTrigger>
          <TabsTrigger value="jobs">Scan History</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-4">
          <SimpleOpportunitiesList />
        </TabsContent>

        <TabsContent value="scan" className="space-y-4">
          {hasActiveScan() && getAvailableMarketplaces().length === 0 ? (
            (() => {
              const runningJob = jobs.find(job => job.status === 'waiting' || job.status === 'active');
              return (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${getStatusColor(runningJob?.status || 'active')} animate-pulse`} />
                      AI Scan In Progress
                    </CardTitle>
                    <CardDescription>
                      An AI optimization scan is currently {runningJob?.status === 'waiting' ? 'waiting to start' : 'running'}. 
                      {getAvailableMarketplaces().length === 0 ? 
                        ' No other marketplaces are available for scanning.' :
                        ' Please wait for it to complete or select a different marketplace.'
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Status</span>
                        <Badge variant="secondary" className="flex items-center gap-1">
                          {getStatusIcon(runningJob?.status || 'active')}
                          {(runningJob?.status || 'ACTIVE').toUpperCase()}
                        </Badge>
                      </div>
                      
                      {runningJob && typeof runningJob.progress === 'number' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Progress</span>
                            <span className="text-sm text-muted-foreground">
                              {runningJob.progress}%
                            </span>
                          </div>
                          <Progress value={runningJob.progress} className="w-full" />
                        </div>
                      )}
                      
                      {runningJob && (
                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div>
                            <span className="text-sm font-medium">Started</span>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(runningJob.processedOn || runningJob.data.createdAt)}
                            </p>
                          </div>
                          {runningJob.result && (
                            <div>
                              <span className="text-sm font-medium">Products Found</span>
                              <p className="text-sm text-muted-foreground">
                                {runningJob.result.totalProducts || 0}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {runningJob && runningJob.data.filters?.marketplace && (
                        <div className="pt-2 border-t">
                          <span className="text-sm font-medium">Scan Filters</span>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge variant="outline">
                              {connectedMarketplaces.find(m => m.id === runningJob.data.filters?.marketplace)?.name || runningJob.data.filters.marketplace}
                            </Badge>
                            {runningJob.data.filters.minDescriptionLength && (
                              <Badge variant="outline">
                                Min length: {runningJob.data.filters.minDescriptionLength}
                              </Badge>
                            )}
                            {runningJob.data.filters.maxDescriptionLength && (
                              <Badge variant="outline">
                                Max length: {runningJob.data.filters.maxDescriptionLength}
                              </Badge>
                            )}
                            {runningJob.data.filters.createdAfter && (
                              <Badge variant="outline">
                                After: {new Date(runningJob.data.filters.createdAfter).toLocaleDateString()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Configure AI Product Scan</CardTitle>
                <CardDescription>
                  Set filters to analyze specific products that need optimization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {scanSuccess && (
                  <Alert className="mb-4 border-green-200 bg-green-50 text-green-900">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      {successMessage}
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Show message when no marketplaces are available */}
                {connectedMarketplaces.length > 0 && getAvailableMarketplaces().length === 0 && !marketplacesLoading ? (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-medium">All marketplaces are currently running scans</p>
                        <p className="text-sm">
                          Please wait for existing scans to complete before starting a new one. 
                          You can monitor the progress in the <strong>Scan History</strong> tab.
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="marketplace">
                    Marketplace <span className="text-red-500">*</span>
                  </Label>
                  <Select value={marketplace} onValueChange={setMarketplace} disabled={marketplacesLoading}>
                    <SelectTrigger>
                      <SelectValue placeholder={
                        marketplacesLoading 
                          ? "Loading marketplaces..." 
                          : getAvailableMarketplaces().length === 0
                          ? "No available marketplaces"
                          : "Select marketplace"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailableMarketplaces().map((mp) => (
                        <SelectItem key={mp.id} value={mp.id}>
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4" />
                            {mp.name}
                            {mp.connectionInfo && (
                              <Badge variant="secondary" className="text-xs">
                                {mp.connectionInfo.productsCount} products
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {connectedMarketplaces.length === 0 && !marketplacesLoading && (
                    <p className="text-sm text-muted-foreground">
                      No marketplaces with products found. Please connect a marketplace and sync products first.
                    </p>
                  )}
                  {hasActiveScan() && getAvailableMarketplaces().length < connectedMarketplaces.length && (
                    <p className="text-sm text-muted-foreground">
                      Some marketplaces are unavailable due to running scans.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="createdAfter">Products Created After (Optional)</Label>
                  <Input
                    id="createdAfter"
                    type="date"
                    value={createdAfter}
                    onChange={(e) => setCreatedAfter(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minLength">Min Description Length (Optional)</Label>
                  <Input
                    id="minLength"
                    type="number"
                    placeholder="e.g., 50"
                    value={minDescriptionLength}
                    onChange={(e) => setMinDescriptionLength(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxLength">Max Description Length (Optional)</Label>
                  <Input
                    id="maxLength"
                    type="number"
                    placeholder="e.g., 500"
                    value={maxDescriptionLength}
                    onChange={(e) => setMaxDescriptionLength(e.target.value)}
                  />
                  </div>

                    <div className="flex justify-end">
                      <Button 
                        onClick={startAIScan} 
                        disabled={
                          scanLoading || 
                          getAvailableMarketplaces().length === 0 || 
                          !marketplace
                        }
                        className="flex items-center gap-2"
                      >
                        <Brain className="h-4 w-4" />
                        {scanLoading ? 'Starting Scan...' : 'Start AI Scan'}
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Show alert for no connected marketplaces with products */}
                {connectedMarketplaces.length === 0 && !marketplacesLoading && (
                  <Alert>
                    <Store className="h-4 w-4" />
                    <AlertDescription>
                      You need at least one marketplace with products before running an AI scan. 
                      Go to the <strong>Stores</strong> page to connect a marketplace and sync your products.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">AI Scan History</h2>
            <Button variant="outline" onClick={loadJobs} disabled={loading}>
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          <div className="grid gap-4">
            {jobs.length === 0 ? (
              <Card>
                <CardContent className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold">No AI scans yet</h3>
                    <p className="text-muted-foreground">
                      Start your first AI optimization scan to analyze your products
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              jobs.map((job) => (
                <Card key={job.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${getStatusColor(job.status)}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="flex items-center gap-1">
                              {getStatusIcon(job.status)}
                              {job.status.toUpperCase()}
                            </Badge>
                            {job.data.filters?.marketplace && (
                              <Badge variant="secondary">
                                {job.data.filters.marketplace}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Started {formatDate(job.data.createdAt)}
                            {job.finishedOn && ` • Finished ${formatDate(job.finishedOn)}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          {job.result && (
                            <div>
                              <p className="font-semibold">
                                {job.result.totalProducts || 0} products
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {job.result.totalBatches || 0} batches
                              </p>
                            </div>
                          )}
                          {job.failedReason && (
                            <p className="text-sm text-red-600">
                              Failed: {job.failedReason}
                            </p>
                          )}
                        </div>
                        {job.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/ai-optimization/results/${job.id}`)}
                            className="flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View Results
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Job Details Modal */}
      <Dialog open={detailsModalOpen} onOpenChange={setDetailsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          {selectedJobDetails && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  AI Scan Details
                </DialogTitle>
                <DialogDescription>
                  Scan ID: {selectedJobDetails.job.id} • {formatDate(selectedJobDetails.job.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="h-[60vh] overflow-y-auto mt-4">
                <div className="space-y-6 pr-4">
                  {/* Summary Section */}
                  <div className="grid grid-cols-4 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Total Products</span>
                        </div>
                        <p className="text-2xl font-bold">{selectedJobDetails.summary.totalProducts}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium">Optimized</span>
                        </div>
                        <p className="text-2xl font-bold text-green-600">{selectedJobDetails.summary.optimized}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium">Failed</span>
                        </div>
                        <p className="text-2xl font-bold text-red-600">{selectedJobDetails.summary.failed}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm font-medium">Pending</span>
                        </div>
                        <p className="text-2xl font-bold text-yellow-600">{selectedJobDetails.summary.pending}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Batches Section */}
                  {selectedJobDetails.batches.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        Processing Batches ({selectedJobDetails.batches.length})
                      </h3>
                      <div className="space-y-2">
                        {selectedJobDetails.batches.map((batch) => (
                          <Card key={batch.id}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Badge variant={batch.status === 'completed' ? 'default' : 'secondary'}>
                                    Batch {batch.batchNumber}/{batch.totalBatches}
                                  </Badge>
                                  <span className="text-sm text-muted-foreground">
                                    {batch.productCount} products
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {batch.progress !== undefined && batch.progress < 100 && (
                                    <Progress value={batch.progress} className="w-20" />
                                  )}
                                  <Badge variant={batch.status === 'completed' ? 'default' : 'outline'}>
                                    {batch.status}
                                  </Badge>
                                </div>
                              </div>
                              {batch.result && (
                                <div className="mt-2 text-sm text-muted-foreground">
                                  Processed: {batch.result.processedCount || 0} • Failed: {batch.result.failedCount || 0}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Products Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Products Analyzed ({selectedJobDetails.products.length})
                    </h3>
                    <div className="grid gap-2">
                      {selectedJobDetails.products.map((product) => (
                        <Card key={product.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                {product.image && (
                                  <img 
                                    src={product.image} 
                                    alt={product.title}
                                    className="w-10 h-10 object-cover rounded"
                                  />
                                )}
                                <div>
                                  <p className="font-medium">{product.title}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-muted-foreground">
                                      {product.externalId}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {product.marketplace}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <Badge 
                                variant={
                                  product.status === 'optimized' ? 'default' : 
                                  product.status === 'failed' ? 'destructive' : 
                                  'secondary'
                                }
                              >
                                {product.status === 'optimized' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                {product.status === 'failed' && <XCircle className="h-3 w-3 mr-1" />}
                                {product.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                                {product.status}
                              </Badge>
                            </div>
                            
                            {/* Description comparison */}
                            {product.descriptions && product.descriptions.wasModified && (
                              <div className="border-t pt-3 space-y-3">
                                <h4 className="text-sm font-medium">Description Changes</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Before (Original)</p>
                                    <div className="bg-red-50 border border-red-200 rounded-md p-2 max-h-24 overflow-y-auto">
                                      <p className="text-xs text-red-800">
                                        {product.descriptions.original || 'No description'}
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">After (Current)</p>
                                    <div className="bg-green-50 border border-green-200 rounded-md p-2 max-h-24 overflow-y-auto">
                                      <p className="text-xs text-green-800">
                                        {product.descriptions.current}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AIOptimizationPage;