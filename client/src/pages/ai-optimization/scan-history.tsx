import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Brain, Clock, Play, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

const AIScanHistoryPage = () => {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const [jobs, setJobs] = useState<AIJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI jobs');
      console.error('Error loading AI jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load jobs on mount and workspace change
  useEffect(() => {
    if (currentWorkspace) {
      loadJobs();
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
              AI Scan History
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
            AI Scan History
          </h1>
          <p className="text-muted-foreground mt-1">
            View the history of all AI optimization scans and their results
          </p>
        </div>
        <Button variant="outline" onClick={loadJobs} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

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
    </div>
  );
};

export default AIScanHistoryPage;