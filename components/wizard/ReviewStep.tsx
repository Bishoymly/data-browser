'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AISchemaAnalysis } from '@/types/schema';
import { SchemaConfig } from '@/types/config';

interface ReviewStepProps {
  connectionName: string;
  schemaConfig: SchemaConfig;
  aiAnalysis: AISchemaAnalysis | null;
  onComplete: () => void;
  onBack: () => void;
}

export function ReviewStep({
  connectionName,
  schemaConfig,
  aiAnalysis,
  onComplete,
  onBack,
}: ReviewStepProps) {
  const tableCount = schemaConfig.showAll
    ? 'All tables'
    : schemaConfig.selectedTables?.length || schemaConfig.selectedSchemas?.length || 0;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Review Configuration</CardTitle>
        <CardDescription>Review your configuration before completing setup.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h3 className="font-semibold">Connection</h3>
          <p className="text-sm text-muted-foreground">{connectionName}</p>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold">Schema Selection</h3>
          <p className="text-sm text-muted-foreground">
            {schemaConfig.showAll
              ? 'All tables will be shown'
              : schemaConfig.selectedSchemas
                ? `Selected schemas: ${schemaConfig.selectedSchemas.join(', ')}`
                : `Selected ${schemaConfig.selectedTables?.length || 0} tables`}
          </p>
        </div>

        {aiAnalysis && (
          <div className="space-y-2">
            <h3 className="font-semibold">AI Analysis</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>✓ Friendly names generated</p>
              <p>✓ Important columns identified</p>
              <p>✓ Display formats configured</p>
              <p>✓ Relationships detected</p>
              <p>✓ Profile layouts designed</p>
            </div>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onComplete}>Complete Setup</Button>
        </div>
      </CardContent>
    </Card>
  );
}

