'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ApiKeyStepProps {
  onNext: (apiKey: string) => void;
  initialApiKey?: string;
}

export function ApiKeyStep({ onNext, initialApiKey = '' }: ApiKeyStepProps) {
  const [apiKey, setApiKey] = useState(initialApiKey);
  const [error, setError] = useState('');

  const handleNext = () => {
    // Allow proceeding even without API key (user can add it later)
    setError('');
    onNext(apiKey.trim() || '');
  };

  const handleSkip = () => {
    setError('');
    onNext('');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AI API Key</CardTitle>
        <CardDescription>
          Enter your OpenAI API key to enable AI-powered schema analysis. This will help
          generate friendly names, identify important columns, and design profile layouts.
          You can skip this step if you don't want AI analysis, but you'll need to provide
          it later if you want to use AI features.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiKey">OpenAI API Key</Label>
          <Input
            id="apiKey"
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setError('');
            }}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="flex justify-between">
          <Button variant="outline" onClick={handleSkip}>
            Skip (Optional)
          </Button>
          <Button onClick={handleNext}>Next</Button>
        </div>
      </CardContent>
    </Card>
  );
}

