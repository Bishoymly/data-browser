'use client';

import { useState, useEffect } from 'react';
import { ApiKeyStep } from './ApiKeyStep';
import { ConnectionStep } from './ConnectionStep';
import { SchemaSelectionStep } from './SchemaSelectionStep';
import { AIAnalysisStep } from './AIAnalysisStep';
import { ReviewStep } from './ReviewStep';
import { ConnectionSelector } from './ConnectionSelector';
import { Card, CardContent } from '@/components/ui/card';
import { DatabaseType, DatabaseConfig } from '@/types/database';
import { SchemaConfig, ConnectionConfig } from '@/types/config';
import { SchemaMetadata, AISchemaAnalysis } from '@/types/schema';
import { useConnectionStore } from '@/stores/connection-store';
import { useSchemaStore } from '@/stores/schema-store';
import { ConfigStorage } from '@/lib/config/storage';
import { SchemaCache } from '@/lib/schema/cache';

type WizardStep = 'api-key' | 'select-connection' | 'connection' | 'schema' | 'analysis' | 'review';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<WizardStep>('api-key');
  const [apiKey, setApiKey] = useState<string>('');
  const [connectionName, setConnectionName] = useState('');
  const [dbType, setDbType] = useState<DatabaseType>('sqlserver');
  const [dbConfig, setDbConfig] = useState<DatabaseConfig | null>(null);
  const [schemaConfig, setSchemaConfig] = useState<SchemaConfig | null>(null);
  const [schemaMetadata, setSchemaMetadata] = useState<SchemaMetadata | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AISchemaAnalysis | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState('Initializing...');
  const [selectedConnection, setSelectedConnection] = useState<ConnectionConfig | null>(null);

  const { connections, addConnection, setActiveConnection, loadFromStorage, activeConnectionId } = useConnectionStore();
  const { setMetadata, setAIAnalysis } = useSchemaStore();

  // Load connections and check for saved API key
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Check for saved API key and connections after they're loaded
  useEffect(() => {
    // Check if API key is already available (env var, global, or saved in connection)
    const envApiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    const globalApiKey = ConfigStorage.getGlobalApiKey();
    
    // Get API key from any saved connection (prefer active connection, then first connection)
    let savedApiKey: string | null = null;
    if (connections.length > 0) {
      const activeConn = activeConnectionId 
        ? connections.find(c => c.id === activeConnectionId)
        : null;
      const connToUse = activeConn || connections[0];
      savedApiKey = connToUse?.aiApiKey || null;
    }
    
    // Determine which API key to use (priority: env > global > connection)
    const keyToUse = envApiKey || globalApiKey || savedApiKey || '';
    
    if (keyToUse && !apiKey) {
      console.log('Loading saved API key');
      setApiKey(keyToUse);
    }
    
    // Skip API key step if we have a key (from env, global, or saved)
    if (step === 'api-key' && keyToUse) {
      console.log('Skipping API key step, key found');
      setStep('select-connection');
    }
  }, [connections, activeConnectionId, step, apiKey]);

  // Handle selecting an existing connection
  const handleSelectConnection = (connection: ConnectionConfig) => {
    setSelectedConnection(connection);
    setConnectionName(connection.name);
    setDbType(connection.type);
    setDbConfig(connection.config);
    setSchemaConfig(connection.schemaConfig);
    setApiKey(connection.aiApiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY || '');
    
    // Load cached schema if available
    const cachedSchema = SchemaCache.get(connection.id);
    if (cachedSchema) {
      setSchemaMetadata(cachedSchema);
      setStep('schema');
    } else {
      // Need to fetch schema
      setStep('analysis');
      fetchSchemaForConnection(connection);
    }
  };

  // Handle creating a new connection
  const handleNewConnection = () => {
    setSelectedConnection(null);
    // API key should already be set at this point, go directly to connection step
    setStep('connection');
  };

  // Fetch schema for an existing connection
  const fetchSchemaForConnection = async (connection: ConnectionConfig) => {
    setAnalysisProgress(0);
    setAnalysisStatus('Fetching table list...');

    try {
      setAnalysisProgress(20);
      setAnalysisStatus('Connecting to database...');

      // First, fetch just table names
      const tablesResponse = await fetch('/api/schema/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: connection.type,
          config: connection.config,
        }),
      });

      if (!tablesResponse.ok) {
        throw new Error('Failed to fetch tables');
      }

      setAnalysisProgress(50);
      setAnalysisStatus('Loading table list...');

      const tablesData = await tablesResponse.json();
      
      // Create minimal schema metadata
      const minimalMetadata: SchemaMetadata = {
        schemas: tablesData.schemas,
        tables: tablesData.tables.map((t: any) => ({
          name: t.name,
          schema: t.schema,
          columns: [],
          rowCount: t.rowCount,
        })),
        relationships: [],
      };
      
      setSchemaMetadata(minimalMetadata);

      setAnalysisProgress(100);
      setAnalysisStatus('Table list loaded!');

      // Cache minimal schema
      SchemaCache.set(connection.id, minimalMetadata);

      setTimeout(() => {
        setStep('schema');
      }, 500);
    } catch (error: any) {
      setAnalysisStatus(`Error: ${error.message}`);
      setTimeout(() => {
        setStep('schema');
      }, 2000);
    }
  };

  const handleApiKeyNext = (key: string) => {
    console.log('API key entered:', key ? '***' + key.slice(-4) : 'empty');
    setApiKey(key);
    
    // Save API key immediately to localStorage
    if (key.trim()) {
      console.log('Saving global API key...');
      ConfigStorage.setGlobalApiKey(key.trim());
    }
    
    setStep('select-connection');
  };

  const handleConnectionTest = async (
    type: DatabaseType,
    config: DatabaseConfig
  ): Promise<boolean> => {
    try {
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, config }),
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  const handleConnectionNext = async (
    type: DatabaseType,
    config: DatabaseConfig,
    name: string
  ) => {
    setDbType(type);
    setDbConfig(config);
    setConnectionName(name);
    
    // Fetch just table names before showing schema selection
    setStep('analysis');
    setAnalysisProgress(0);
    setAnalysisStatus('Initializing...');

    // Progress simulation with real updates
    const progressSteps = [
      { progress: 10, status: 'Validating connection details...' },
      { progress: 20, status: 'Connecting to database server...' },
      { progress: 40, status: 'Authenticating...' },
      { progress: 60, status: 'Fetching database schemas...' },
      { progress: 80, status: 'Loading table list...' },
      { progress: 95, status: 'Finalizing...' },
    ];

    let currentStep = 0;
    const progressInterval = setInterval(() => {
      if (currentStep < progressSteps.length) {
        const step = progressSteps[currentStep];
        setAnalysisProgress(step.progress);
        setAnalysisStatus(step.status);
        currentStep++;
      }
    }, 300); // Update every 300ms

    try {
      const response = await fetch('/api/schema/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          config,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch tables');
      }

      setAnalysisProgress(90);
      setAnalysisStatus('Processing results...');

      const data = await response.json();
      
      // Create minimal schema metadata with just table names (no columns yet)
      const minimalMetadata: SchemaMetadata = {
        schemas: data.schemas,
        tables: data.tables.map((t: any) => ({
          name: t.name,
          schema: t.schema,
          columns: [], // Columns will be fetched after selection
          rowCount: t.rowCount,
        })),
        relationships: [], // Relationships will be fetched after selection
      };
      
      setSchemaMetadata(minimalMetadata);

      setAnalysisProgress(100);
      setAnalysisStatus(`Success! Found ${data.schemas.length} schemas and ${data.tables.length} tables`);

      setTimeout(() => {
        setStep('schema');
      }, 800);
    } catch (error: any) {
      clearInterval(progressInterval);
      setAnalysisProgress(0);
      setAnalysisStatus(`Error: ${error.message}`);
      // Still proceed to schema selection
      setTimeout(() => {
        setStep('schema');
      }, 2000);
    }
  };

  const handleSchemaNext = async (config: SchemaConfig) => {
    setSchemaConfig(config);
    
    // Now fetch detailed schema (columns, relationships) for selected tables
    setStep('analysis');
    setAnalysisProgress(0);
    setAnalysisStatus('Initializing schema extraction...');

    // Prepare selected tables/schemas for API
    const selectedTables = config.showAll 
      ? undefined 
      : config.selectedTables || undefined;
    const selectedSchemas = config.showAll 
      ? undefined 
      : config.selectedSchemas || undefined;

    const tableCount = selectedTables?.length || (selectedSchemas ? 'multiple' : 'all');
    
    // Progress updates for schema extraction - continue updating while waiting
    let currentProgress = 5;
    let currentStepIndex = 0;
    const progressSteps = [
      { progress: 5, status: 'Connecting to database...' },
      { progress: 15, status: 'Preparing schema extraction...' },
      { progress: 25, status: `Processing ${tableCount} tables...` },
      { progress: 40, status: 'Extracting column information...' },
      { progress: 55, status: 'Analyzing relationships...' },
      { progress: 70, status: 'Processing foreign keys...' },
    ];

    // Start progress updates
    const progressInterval = setInterval(() => {
      // Move to next step if we've been on current step long enough
      if (currentStepIndex < progressSteps.length - 1) {
        const currentStep = progressSteps[currentStepIndex];
        const nextStep = progressSteps[currentStepIndex + 1];
        
        // Gradually increase progress between steps
        if (currentProgress < nextStep.progress) {
          currentProgress = Math.min(currentProgress + 2, nextStep.progress);
        } else {
          currentStepIndex++;
        }
        
        setAnalysisProgress(currentProgress);
        setAnalysisStatus(progressSteps[currentStepIndex].status);
      } else {
        // On last step, slowly increment to 75% max while waiting
        if (currentProgress < 75) {
          currentProgress = Math.min(currentProgress + 1, 75);
          setAnalysisProgress(currentProgress);
        }
        // Keep showing the last status message
        setAnalysisStatus(progressSteps[currentStepIndex].status);
      }
    }, 500); // Update every 500ms

    try {
      const response = await fetch('/api/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: dbType,
          config: dbConfig,
          apiKey: apiKey || undefined,
          selectedTables,
          selectedSchemas,
        }),
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Schema extraction failed');
      }

      setAnalysisProgress(75);
      setAnalysisStatus('Processing schema details...');

      const data = await response.json();
      setSchemaMetadata(data.metadata);

      // Run AI analysis if API key provided
      if (apiKey || process.env.NEXT_PUBLIC_OPENAI_API_KEY) {
        setAnalysisProgress(80);
        setAnalysisStatus('Sending schema to AI for analysis...');
        
        // AI analysis is already included in the response, but show progress while waiting
        // Since AI happens on server, we simulate progress updates
        const aiProgressSteps = [
          { progress: 82, status: 'AI is analyzing table structures...' },
          { progress: 84, status: 'Generating friendly names...' },
          { progress: 86, status: 'Identifying important columns...' },
          { progress: 88, status: 'Analyzing display formats...' },
          { progress: 90, status: 'Detecting lookup relationships...' },
          { progress: 92, status: 'Designing profile layouts...' },
          { progress: 94, status: 'Finalizing AI analysis...' },
          { progress: 96, status: 'Almost done...' },
        ];
        
        let aiStep = 0;
        const aiInterval = setInterval(() => {
          if (aiStep < aiProgressSteps.length) {
            const step = aiProgressSteps[aiStep];
            setAnalysisProgress(step.progress);
            setAnalysisStatus(step.status);
            aiStep++;
          } else {
            // Loop back to show it's still processing
            aiStep = Math.max(0, aiProgressSteps.length - 2);
            setAnalysisProgress(96);
            setAnalysisStatus('AI analysis in progress...');
          }
        }, 2000); // Update every 2 seconds

        // AI analysis is already included in the response
        setAiAnalysis(data.aiAnalysis || null);
        
        // Clear interval when done (response already received)
        clearInterval(aiInterval);
      }

      setAnalysisProgress(100);
      const tableCount = data.metadata.tables.length;
      const relCount = data.metadata.relationships.length;
      setAnalysisStatus(`Complete! Processed ${tableCount} tables with ${relCount} relationships`);

      setTimeout(() => {
        setStep('review');
      }, 800);
    } catch (error: any) {
      clearInterval(progressInterval);
      setAnalysisProgress(0);
      setAnalysisStatus(`Error: ${error.message}`);
      // Still proceed to review even if analysis fails
      setTimeout(() => {
        setStep('review');
      }, 2000);
    }
  };

  const handleReviewComplete = () => {
    if (!dbConfig || !schemaConfig) {
      return;
    }

    // If updating existing connection, use its ID, otherwise create new
    const connectionId = selectedConnection?.id || `conn_${Date.now()}`;
    const connectionConfig: ConnectionConfig = {
      id: connectionId,
      name: connectionName,
      type: dbType,
      config: dbConfig,
      schemaConfig,
      aiAnalysis: aiAnalysis || selectedConnection?.aiAnalysis || undefined,
      uiPreferences: selectedConnection?.uiPreferences || {
        hiddenColumns: {},
        columnOrder: {},
        defaultSorts: {},
      },
      aiApiKey: apiKey || selectedConnection?.aiApiKey || undefined,
    };

    // Save to store and storage
    console.log('Saving connection:', {
      connectionId,
      name: connectionName,
      isUpdate: !!selectedConnection,
    });
    
    if (selectedConnection) {
      // Update existing connection
      console.log('Updating existing connection');
      useConnectionStore.getState().updateConnection(connectionId, connectionConfig);
    } else {
      // Add new connection
      console.log('Adding new connection');
      addConnection(connectionConfig);
    }
    
    console.log('Setting active connection:', connectionId);
    setActiveConnection(connectionId);
    
    // Force save to ensure it's persisted
    useConnectionStore.getState().saveToStorage();

    // Update schema store
    if (schemaMetadata) {
      setMetadata(schemaMetadata);
      SchemaCache.set(connectionId, schemaMetadata);
    }
    if (aiAnalysis) {
      setAIAnalysis(aiAnalysis);
    }

    // Verify save completed
    const savedConfig = ConfigStorage.get();
    console.log('Verification - Config after save:', {
      saved: !!savedConfig,
      connectionsCount: savedConfig?.connections.length || 0,
      activeConnectionId: savedConfig?.activeConnectionId,
    });

    // Reload connections to ensure state is synced
    loadFromStorage();
    
    // Small delay to ensure save completes and state is synced
    setTimeout(() => {
      onComplete();
    }, 300);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {step === 'api-key' && (
        <ApiKeyStep onNext={handleApiKeyNext} initialApiKey={apiKey} />
      )}
      {step === 'select-connection' && (
        <ConnectionSelector
          connections={connections}
          onSelect={handleSelectConnection}
          onNew={handleNewConnection}
        />
      )}
      {step === 'connection' && (
        <ConnectionStep
          onNext={handleConnectionNext}
          onTest={handleConnectionTest}
          initialType={dbType}
          initialConfig={dbConfig || undefined}
          initialName={connectionName}
        />
      )}
      {step === 'schema' && schemaMetadata ? (
        <SchemaSelectionStep
          schemas={schemaMetadata.schemas}
          tables={schemaMetadata.tables}
          onNext={handleSchemaNext}
        />
      ) : step === 'schema' ? (
        <Card className="w-full max-w-2xl mx-auto">
          <CardContent className="p-6">
            <p>Loading schema...</p>
          </CardContent>
        </Card>
      ) : null}
      {step === 'analysis' && (
        <AIAnalysisStep progress={analysisProgress} status={analysisStatus} />
      )}
      {step === 'review' && (
        <ReviewStep
          connectionName={connectionName}
          schemaConfig={schemaConfig!}
          aiAnalysis={aiAnalysis}
          onComplete={handleReviewComplete}
          onBack={() => setStep('schema')}
        />
      )}
    </div>
  );
}

