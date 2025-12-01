'use client';

import { useSchemaStore } from '@/stores/schema-store';
import { useConnectionStore } from '@/stores/connection-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function DashboardPage() {
  const { metadata } = useSchemaStore();
  const { getActiveConnection } = useConnectionStore();
  const connection = getActiveConnection();

  if (!metadata || !connection) {
    return (
      <div className="p-4">
        <p>No schema available. Please complete the onboarding wizard.</p>
      </div>
    );
  }

  const tableCount = metadata.tables.length;
  const schemaCount = metadata.schemas.length;
  const relationshipCount = metadata.relationships.length;

  return (
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
  );
}

