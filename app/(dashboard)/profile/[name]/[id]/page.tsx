'use client';

import { use } from 'react';
import { ProfileView } from '@/components/profile/ProfileView';
import { useSchemaStore } from '@/stores/schema-store';

export default function ProfilePage({
  params,
}: {
  params: Promise<{ name: string; id: string }>;
}) {
  const resolvedParams = use(params);
  const tableName = decodeURIComponent(resolvedParams.name);
  const recordId = decodeURIComponent(resolvedParams.id);
  const { metadata } = useSchemaStore();

  // Parse schema and table name
  const parts = tableName.split('.');
  const schema = parts.length > 1 ? parts[0] : undefined;
  const name = parts.length > 1 ? parts.slice(1).join('.') : parts[0];

  if (!metadata) {
    return <div className="p-4">Loading schema...</div>;
  }

  const table = metadata.tables.find(
    (t) => t.name === name && (schema ? t.schema === schema : !t.schema)
  );

  if (!table) {
    return <div className="p-4">Table not found</div>;
  }

  return <ProfileView tableName={name} schema={schema} recordId={recordId} />;
}

