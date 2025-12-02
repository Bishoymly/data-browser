'use client';

import { useEffect, useState, Suspense } from 'react';
import { OnboardingWizard } from '@/components/wizard/OnboardingWizard';
import { useConnectionStore } from '@/stores/connection-store';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useSchemaStore } from '@/stores/schema-store';
import { SchemaCache } from '@/lib/schema/cache';

function HomeContent() {
  const { connections, loadFromStorage, activeConnectionId, getActiveConnection } = useConnectionStore();
  const { setMetadata, setAIAnalysis } = useSchemaStore();
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  // Redirect to dashboard if connection exists, but only if we're on the home page
  // Don't redirect if user explicitly wants to add a new connection
  useEffect(() => {
    const wantsNewConnection = searchParams?.get('new-connection') === 'true';
    
    if (!isLoading && activeConnectionId && connections.length > 0 && pathname === '/' && !wantsNewConnection) {
      router.push('/dashboard');
    }
  }, [isLoading, activeConnectionId, connections.length, router, pathname, searchParams]);

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

  // Check if user wants to add a new connection
  const wantsNewConnection = searchParams?.get('new-connection') === 'true';

  // If no connections, no active connection, or user wants to add new connection, show wizard
  if (connections.length === 0 || !activeConnectionId || wantsNewConnection) {
    return <OnboardingWizard onComplete={handleWizardComplete} />;
  }

  // If connection exists, show redirect message (redirect handled by useEffect above)
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div>Redirecting to dashboard...</div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
