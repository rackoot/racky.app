import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Brain, Clock, Play, CheckCircle2, XCircle, Store } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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

const AIStartScanPage = () => {
  const { currentWorkspace } = useWorkspace();
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [activeJob, setActiveJob] = useState<AIJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  // Connected marketplaces and their availability
  const [connectedMarketplaces, setConnectedMarketplaces] = useState<Marketplace[]>([]);
  const [marketplacesLoading, setMarketplacesLoading] = useState(false);
  const [marketplaceAvailability, setMarketplaceAvailability] = useState<any[]>([]);
  
  // Helper function to check if any scan is active/waiting
  const hasActiveScan = () => {
    return jobs.some(job => job.status === 'waiting' || job.status === 'active');
  };
  
  // Helper function to get marketplace with active/waiting scan
  const getActiveMarketplace = () => {
    const activeJob = jobs.find(job => job.status === 'waiting' || job.status === 'active');
    return activeJob?.data.filters?.marketplace;
  };
  
  // Helper function to get available marketplaces using availability data
  const getAvailableMarketplaces = React.useCallback(() => {
    if (marketplaceAvailability.length === 0) {
      return []; // No availability data yet
    }
    
    // Get available marketplaces from availability data and match with connected marketplaces
    const availableMarketplaceIds = marketplaceAvailability
      .filter(mp => mp.available)
      .map(mp => mp.marketplace);
    
    return connectedMarketplaces.filter(mp => 
      availableMarketplaceIds.includes(mp.id) && 
      mp.connectionInfo
    );
  }, [marketplaceAvailability, connectedMarketplaces]);
  
  // Helper function to get marketplace availability info
  const getMarketplaceAvailabilityInfo = React.useCallback((marketplaceId: string) => {
    return marketplaceAvailability.find(mp => mp.marketplace === marketplaceId);
  }, [marketplaceAvailability]);
  
  // Scan filters
  const [marketplace, setMarketplace] = useState<string>('');
  const [minDescriptionLength, setMinDescriptionLength] = useState<string>('');
  const [maxDescriptionLength, setMaxDescriptionLength] = useState<string>('');
  const [createdAfter, setCreatedAfter] = useState<string>('');

  // Load marketplace availability
  const loadMarketplaceAvailability = async () => {
    if (!currentWorkspace || !currentWorkspace._id) {
      console.log('[DEBUG] No workspace selected, skipping marketplace availability load');
      return;
    }
    
    console.log('[DEBUG] Loading marketplace availability for workspace:', currentWorkspace._id);
    
    try {
      const response = await fetch(`/api/opportunities/ai/marketplace-availability?t=${Date.now()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Workspace-ID': currentWorkspace._id,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[DEBUG] Marketplace availability response:', data);
        setMarketplaceAvailability(data.data.marketplaces || []);
      } else {
        console.error('[DEBUG] Failed to load marketplace availability:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('[DEBUG] Error loading marketplace availability:', err);
    }
  };

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
      
    } catch (err) {
      setError('Failed to load connected marketplaces');
    } finally {
      setMarketplacesLoading(false);
    }
  };

  // Auto-select marketplace after availability data is loaded
  React.useEffect(() => {
    if (connectedMarketplaces.length > 0 && marketplaceAvailability.length > 0) {
      const available = getAvailableMarketplaces();
      if (!marketplace && available.length > 0) {
        setMarketplace(available[0].id);
      } else if (marketplace && !available.find(mp => mp.id === marketplace)) {
        // Reset selection if currently selected marketplace is no longer available
        setMarketplace(available.length > 0 ? available[0].id : '');
      }
    }
  }, [connectedMarketplaces, marketplaceAvailability, marketplace, getAvailableMarketplaces]);

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
      setJobs(data.data?.jobs || data.data || []);
      
      // Find active job for monitoring
      const jobsList = data.data?.jobs || data.data || [];
      const active = jobsList.find((job: AIJob) => job.status === 'active');
      if (active) {
        setActiveJob(active);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI jobs');
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
    
    // Prevent multiple calls while already loading
    if (scanLoading) {
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
      
      // Reload jobs, marketplaces and availability to ensure form is updated
      await Promise.all([
        loadJobs(),
        loadConnectedMarketplaces(),
        loadMarketplaceAvailability()
      ]);
      
      // Small delay to ensure the new job appears in the backend
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Reload jobs again to make sure we have the latest state
      await loadJobs();
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setScanSuccess(false);
        setSuccessMessage('');
      }, 5000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start AI scan');
      setScanSuccess(false);
      setSuccessMessage('');
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
      }
    };
    
    const interval = setInterval(pollJobStatus, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [activeJob, currentWorkspace]);

  // Load jobs, marketplaces and availability on mount and workspace change
  useEffect(() => {
    if (currentWorkspace) {
      loadJobs();
      loadConnectedMarketplaces();
      loadMarketplaceAvailability();
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
              Start AI Scan
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
            Start AI Scan
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure and start an AI optimization scan for your products
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
            {connectedMarketplaces.length > 0 && getAvailableMarketplaces().length === 0 && !marketplacesLoading && marketplaceAvailability.length > 0 ? (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">
                      {marketplaceAvailability.some(mp => mp.reason === 'scan_in_progress')
                        ? 'All marketplaces are currently running scans'
                        : marketplaceAvailability.some(mp => mp.reason === 'cooldown_24h')
                        ? 'All marketplaces are on cooldown (scanned within 24 hours)'
                        : marketplaceAvailability.some(mp => mp.reason === 'no_products')
                        ? 'No products available in connected marketplaces'
                        : 'No marketplaces available for scanning'}
                    </p>
                    <p className="text-sm">
                      {marketplaceAvailability.some(mp => mp.reason === 'scan_in_progress')
                        ? 'Please wait for existing scans to complete before starting a new one. You can monitor the progress in the Scan History page.'
                        : marketplaceAvailability.some(mp => mp.reason === 'cooldown_24h')
                        ? 'Marketplaces can only be scanned once every 24 hours. Please wait for the cooldown to expire.'
                        : marketplaceAvailability.some(mp => mp.reason === 'no_products')
                        ? 'Please sync some products from your marketplaces before running an AI scan.'
                        : 'Make sure your marketplaces have products available for scanning.'}
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
                  {getAvailableMarketplaces().map((mp) => {
                    const availabilityInfo = getMarketplaceAvailabilityInfo(mp.id);
                    return (
                      <SelectItem key={mp.id} value={mp.id}>
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4" />
                          {mp.name}
                          {availabilityInfo && (
                            <div className="flex gap-1">
                              <Badge variant="secondary" className="text-xs">
                                {availabilityInfo.availableProducts || availabilityInfo.totalProducts} products
                              </Badge>
                              {availabilityInfo.recentlyScanned > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {availabilityInfo.recentlyScanned} recently scanned
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {connectedMarketplaces.length === 0 && !marketplacesLoading && (
                <p className="text-sm text-muted-foreground">
                  No marketplaces with products found. Please connect a marketplace and sync products first.
                </p>
              )}
              {marketplaceAvailability.length > 0 && getAvailableMarketplaces().length < connectedMarketplaces.length && (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Some marketplaces are unavailable:</p>
                  <ul className="text-xs space-y-1 ml-4">
                    {marketplaceAvailability.filter(mp => !mp.available).map(mp => {
                      const connectedMp = connectedMarketplaces.find(cm => cm.id === mp.marketplace);
                      if (!connectedMp) return null;
                      
                      return (
                        <li key={mp.marketplace} className="flex items-center gap-2">
                          <span>• {connectedMp.name}:</span>
                          {mp.reason === 'scan_in_progress' && <span>scan in progress</span>}
                          {mp.reason === 'cooldown_24h' && <span>all products scanned in last 24h</span>}
                          {mp.reason === 'no_products_match' && <span>no products match filters</span>}
                          {mp.cooldownEndsAt && (
                            <span className="text-xs opacity-75">
                              (available {new Date(mp.cooldownEndsAt).toLocaleTimeString()})
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
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
    </div>
  );
};

export default AIStartScanPage;