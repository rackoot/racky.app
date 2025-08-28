import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Brain, Clock, Play, CheckCircle2, XCircle, Filter, Search, Store } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

const AIOptimizationPage = () => {
  const { currentWorkspace } = useWorkspace();
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [activeJob, setActiveJob] = useState<AIJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  
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
  
  // Helper function to get available marketplaces (connected but not running scans)
  const getAvailableMarketplaces = () => {
    const activeMarketplace = getActiveMarketplace();
    return connectedMarketplaces.filter(mp => mp.id !== activeMarketplace);
  };
  
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
      // Filter to only connected marketplaces
      const connected = marketplaces.filter(m => m.connectionInfo);
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
      setJobs(data.data?.jobs || []);
      
      // Find active job for monitoring
      const active = data.data?.jobs?.find((job: AIJob) => job.status === 'active');
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

  // Start AI scan
  const startAIScan = async () => {
    if (!currentWorkspace || !currentWorkspace._id) {
      setError('No workspace selected');
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
      
      // Reload jobs to show the new scan
      await loadJobs();
      
      // Clear form (keep marketplace selected since it's required)
      setMinDescriptionLength('');
      setMaxDescriptionLength('');
      setCreatedAfter('');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start AI scan');
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
                      No connected marketplaces found. Please connect a marketplace first.
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
              
              {getAvailableMarketplaces().length === 0 && !marketplacesLoading && (
                <Alert>
                  <Store className="h-4 w-4" />
                  <AlertDescription>
                    {connectedMarketplaces.length === 0 ? (
                      <>
                        You need to connect at least one marketplace before running an AI scan. 
                        Go to the <strong>Stores</strong> page to connect your first marketplace.
                      </>
                    ) : (
                      <>
                        All connected marketplaces are currently running scans. 
                        Please wait for them to complete or check the <strong>Scan History</strong> tab.
                      </>
                    )}
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
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AIOptimizationPage;