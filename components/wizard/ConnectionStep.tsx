'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DatabaseType, DatabaseConfig } from '@/types/database';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface ConnectionStepProps {
  onNext: (type: DatabaseType, config: DatabaseConfig, connectionName: string) => void;
  onTest: (type: DatabaseType, config: DatabaseConfig) => Promise<boolean>;
  initialType?: DatabaseType;
  initialConfig?: Partial<DatabaseConfig>;
  initialName?: string;
}

export function ConnectionStep({
  onNext,
  onTest,
  initialType = 'sqlserver',
  initialConfig = {},
  initialName = '',
}: ConnectionStepProps) {
  const [type, setType] = useState<DatabaseType>(initialType);
  const [name, setName] = useState(initialName);
  const [config, setConfig] = useState<DatabaseConfig>({
    server: initialConfig.server || '',
    database: initialConfig.database || '',
    username: initialConfig.username || '',
    password: initialConfig.password || '',
    port: initialConfig.port || (initialType === 'sqlserver' ? 1433 : undefined),
  });
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [testSuccess, setTestSuccess] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setError('');
    setTestSuccess(false);

    try {
      // Show progress updates
      const progressInterval = setInterval(() => {
        // This will be handled by the API response timing
      }, 100);

      const success = await onTest(type, config);
      
      clearInterval(progressInterval);
      
      if (success) {
        setTestSuccess(true);
      } else {
        setError('Connection test failed');
      }
    } catch (err: any) {
      setError(err.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleNext = () => {
    if (!name.trim()) {
      setError('Connection name is required');
      return;
    }
    if (!config.server || !config.database || !config.username || !config.password) {
      setError('All fields are required');
      return;
    }
    if (!testSuccess) {
      setError('Please test the connection first');
      return;
    }
    setError('');
    onNext(type, config, name);
  };


  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Database Connection</CardTitle>
        <CardDescription>
          Enter your database connection details to get started.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Connection Name</Label>
          <Input
            id="name"
            placeholder="My Database"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError('');
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Database Type</Label>
          <Select value={type} onValueChange={(value) => setType(value as DatabaseType)}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sqlserver">SQL Server</SelectItem>
              {/* Future: <SelectItem value="postgresql">PostgreSQL</SelectItem> */}
              {/* Future: <SelectItem value="mysql">MySQL</SelectItem> */}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="server">Server</Label>
            <Input
              id="server"
              placeholder="localhost"
              value={config.server}
              onChange={(e) => {
                setConfig({ ...config, server: e.target.value });
                setError('');
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              placeholder={type === 'sqlserver' ? '1433' : '5432'}
              value={config.port || ''}
              onChange={(e) => {
                setConfig({
                  ...config,
                  port: e.target.value ? parseInt(e.target.value) : undefined,
                });
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="database">Database</Label>
          <Input
            id="database"
            placeholder="mydb"
            value={config.database}
            onChange={(e) => {
              setConfig({ ...config, database: e.target.value });
              setError('');
            }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="sa"
              value={config.username}
              onChange={(e) => {
                setConfig({ ...config, username: e.target.value });
                setError('');
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={config.password}
              onChange={(e) => {
                setConfig({ ...config, password: e.target.value });
                setError('');
              }}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {testSuccess && (
          <p className="text-sm text-green-600">Connection test successful!</p>
        )}

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testing || !config.server || !config.database}
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
          <Button onClick={handleNext} disabled={!testSuccess}>
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

