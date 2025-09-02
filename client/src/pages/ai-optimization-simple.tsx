import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain } from 'lucide-react';

const AIOptimizationSimple = () => {
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

      <Card>
        <CardHeader>
          <CardTitle>AI Product Optimization</CardTitle>
        </CardHeader>
        <CardContent>
          <p>AI optimization dashboard is loading...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AIOptimizationSimple;