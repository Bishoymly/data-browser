'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface AIAnalysisStepProps {
  progress: number;
  status: string;
}

export function AIAnalysisStep({ progress, status }: AIAnalysisStepProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AI Schema Analysis</CardTitle>
        <CardDescription>
          Analyzing your database schema to generate friendly names, identify important
          columns, and design profile layouts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">{status}</span>
            <span className="text-muted-foreground">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          {progress < 100 && (
            <p className="text-xs text-muted-foreground text-center mt-2">
              Please wait, this may take a moment...
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

