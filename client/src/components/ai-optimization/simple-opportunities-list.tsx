import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Brain, Loader2 } from 'lucide-react';

interface Opportunity {
  _id: string;
  title: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'completed' | 'dismissed';
  createdAt: string;
}

export const SimpleOpportunitiesList: React.FC = () => {
  const { currentWorkspace } = useWorkspace();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOpportunities = async () => {
    if (!currentWorkspace || !currentWorkspace._id) {
      setError('No workspace selected');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/opportunities?limit=25&offset=0', {
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
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load opportunities');
      console.error('Error loading opportunities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentWorkspace && currentWorkspace._id) {
      loadOpportunities();
    }
  }, [currentWorkspace]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Optimization Opportunities</h2>
          <p className="text-muted-foreground">
            AI-generated recommendations to improve your products
          </p>
        </div>
        <Button onClick={loadOpportunities} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {loading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && !error ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Loading opportunities...</p>
            </div>
          </CardContent>
        </Card>
      ) : opportunities.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No opportunities found</h3>
              <p className="text-muted-foreground">
                Run an AI scan to generate optimization opportunities for your products
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {opportunities.map((opportunity) => (
            <Card key={opportunity._id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{opportunity.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${getPriorityColor(opportunity.priority)}`} />
                    <Badge variant="outline" className="capitalize">
                      {opportunity.priority}
                    </Badge>
                    <Badge variant={opportunity.status === 'active' ? 'default' : 'secondary'}>
                      {opportunity.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-2">{opportunity.description}</p>
                <div className="flex items-center justify-between text-sm">
                  <Badge variant="outline">{opportunity.category}</Badge>
                  <span className="text-muted-foreground">
                    {new Date(opportunity.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};