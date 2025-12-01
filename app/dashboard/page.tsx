'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useConnectionStore } from '@/stores/connection-store';
import { useSchemaStore } from '@/stores/schema-store';
import { SchemaCache } from '@/lib/schema/cache';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { useUIStore } from '@/stores/ui-store';
import { ConfigExport } from '@/components/config/ConfigExport';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function DashboardPage() {
  const router = useRouter();
  const { connections, loadFromStorage, activeConnectionId, getActiveConnection } = useConnectionStore();
  const { metadata, setMetadata, setAIAnalysis } = useSchemaStore();
  const { sidebarOpen } = useUIStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (connections.length === 0 || !activeConnectionId) {
      router.push('/');
      return;
    }

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
  }, [connections.length, activeConnectionId, getActiveConnection, router, setMetadata, setAIAnalysis]);

  if (connections.length === 0 || !activeConnectionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Redirecting...</div>
      </div>
    );
  }

  const connection = getActiveConnection();
  if (!metadata || !connection) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className={`flex-1 overflow-auto transition-all ${sidebarOpen ? 'md:ml-64' : ''}`}>
          <div className="p-6">
            <div className="mb-4 flex justify-end">
              <ConfigExport />
            </div>
            <div className="p-4">
              <p>No schema available. Please complete the onboarding wizard.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const tableCount = metadata.tables.length;
  const schemaCount = metadata.schemas.length;
  const relationshipCount = metadata.relationships.length;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className={`flex-1 overflow-auto transition-all ${sidebarOpen ? 'md:ml-64' : ''}`}>
        <div className="p-6">
          <div className="mb-4 flex justify-end">
            <ConfigExport />
          </div>
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Database Browser</h1>
              <p className="text-muted-foreground">Connection: {connection.name}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Schemas</CardTitle>
                  <CardDescription>Total schemas in database</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{schemaCount}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tables</CardTitle>
                  <CardDescription>Total tables available</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{tableCount}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Relationships</CardTitle>
                  <CardDescription>Foreign key relationships</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{relationshipCount}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Quick Access</CardTitle>
                <CardDescription>Browse your database tables</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Use the sidebar to navigate to tables, or select a table from the list above.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
