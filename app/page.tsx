'use client';

import { useEffect, useState } from 'react';
import { OnboardingWizard } from '@/components/wizard/OnboardingWizard';
import { useConnectionStore } from '@/stores/connection-store';
import { useRouter } from 'next/navigation';
import { useSchemaStore } from '@/stores/schema-store';
import { SchemaCache } from '@/lib/schema/cache';

export default function Home() {
  const { connections, loadFromStorage, activeConnectionId, getActiveConnection } = useConnectionStore();
  const { setMetadata, setAIAnalysis } = useSchemaStore();
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Load from storage first
    loadFromStorage();
    
    // Wait a bit for state to update, then check
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [loadFromStorage]);

  // Load schema when connection exists
  useEffect(() => {
    if (!isLoading && connections.length > 0 && activeConnectionId) {
      const connection = getActiveConnection();
      if (connection) {
        // Load cached schema
        const cachedSchema = SchemaCache.get(connection.id);
        if (cachedSchema) {
          setMetadata(cachedSchema);
        }
        // Load AI analysis
        if (connection.aiAnalysis) {
          setAIAnalysis(connection.aiAnalysis);
        }
      }
    }
  }, [isLoading, connections.length, activeConnectionId, getActiveConnection, setMetadata, setAIAnalysis]);

  // Redirect to dashboard if connection exists
  useEffect(() => {
    if (!isLoading && activeConnectionId && connections.length > 0) {
      router.push('/dashboard');
    }
  }, [isLoading, activeConnectionId, connections.length, router]);

  const handleWizardComplete = () => {
    // Redirect to dashboard after wizard completes
    router.push('/dashboard');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  // If no connections or no active connection, show wizard
  if (connections.length === 0 || !activeConnectionId) {
    return <OnboardingWizard onComplete={handleWizardComplete} />;
  }

  // If connection exists, show redirect message (redirect handled by useEffect above)
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div>Redirecting to dashboard...</div>
    </div>
  );
}
