import React from 'react';
import { useWorkspace } from '@/components/workspace/workspace-context';
import { Brain } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SimpleOpportunitiesList } from '@/components/ai-optimization/simple-opportunities-list';

const AIOpportunitiesPage = () => {
  const { currentWorkspace } = useWorkspace();

  // Show loading state if no workspace is selected
  if (!currentWorkspace) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Brain className="h-8 w-8 text-primary" />
              AI Opportunities
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
            AI Opportunities
          </h1>
          <p className="text-muted-foreground mt-1">
            Review AI-generated optimization opportunities for your products
          </p>
        </div>
      </div>

      <SimpleOpportunitiesList />
    </div>
  );
};

export default AIOpportunitiesPage;