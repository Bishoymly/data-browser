'use client';

import { use } from 'react';
import { DataGrid } from '@/components/grid/DataGrid';
import { useSchemaStore } from '@/stores/schema-store';
import { useUIStore } from '@/stores/ui-store';

export default function TablePage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const resolvedParams = use(params);
  const tableName = decodeURIComponent(resolvedParams.name);
  const { metadata, aiAnalysis } = useSchemaStore();
  const { showFriendlyNames } = useUIStore();

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

  // Get friendly name for table
  const getTableDisplayName = (): string => {
    const tableKey = schema ? `${schema}.${name}` : name;
    if (showFriendlyNames && aiAnalysis?.friendlyNames) {
      // Try multiple key formats
      let friendlyName = aiAnalysis.friendlyNames[tableKey];
      if (!friendlyName && schema) {
        friendlyName = aiAnalysis.friendlyNames[name];
      }
      if (friendlyName) {
        return friendlyName;
      }
    }
    return schema ? `${schema}.${name}` : name;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          {getTableDisplayName()}
        </h1>
      </div>
      <DataGrid tableName={name} schema={schema} />
    </div>
  );
}

