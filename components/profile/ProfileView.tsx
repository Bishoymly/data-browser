'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RelationCard } from './RelationCard';
import { useConnectionStore } from '@/stores/connection-store';
import { useSchemaStore } from '@/stores/schema-store';
import { useUIStore } from '@/stores/ui-store';
import { ProfileLayout } from '@/types/schema';
import { DatabaseType } from '@/types/database';

interface ProfileViewProps {
  tableName: string;
  schema?: string;
  recordId: string | number;
}

export function ProfileView({ tableName, schema, recordId }: ProfileViewProps) {
  const { getActiveConnection } = useConnectionStore();
  const { metadata, aiAnalysis } = useSchemaStore();
  const { showFriendlyNames } = useUIStore();

  const [recordData, setRecordData] = useState<any>(null);
  const [relatedData, setRelatedData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const connection = getActiveConnection();
  if (!connection || !metadata) {
    return <div>No connection available</div>;
  }

  const table = metadata.tables.find(
    (t) => t.name === tableName && (schema ? t.schema === schema : !t.schema)
  );

  const profileLayout: ProfileLayout | undefined = aiAnalysis?.profileLayouts[
    schema ? `${schema}.${tableName}` : tableName
  ];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch the main record
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: connection.type,
            config: connection.config,
            table: tableName,
            schema,
            options: {
              filters: [
                {
                  column: table?.columns.find((c) => c.primaryKey)?.name || 'id',
                  operator: 'equals',
                  value: recordId,
                },
              ],
            },
          }),
        });

        if (response.ok) {
          const result = await response.json();
          if (result.rows.length > 0) {
            setRecordData(result.rows[0]);
          }
        }

        // Fetch related data if layout is available
        if (profileLayout && table) {
          const related: Record<string, any[]> = {};
          for (const card of profileLayout.cards) {
            if (card.type === 'related-table' && card.relationship && recordData) {
              // Fetch related records
              const rel = card.relationship;
              const foreignKeyColumn =
                rel.fromTable === tableName ? rel.fromColumn : rel.toColumn;
              const relatedTable = rel.fromTable === tableName ? rel.toTable : rel.fromTable;

              const relatedResponse = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: connection.type,
                  config: connection.config,
                  table: relatedTable,
                  schema: rel.toSchema || rel.fromSchema,
                  options: {
                    filters: [
                      {
                        column: foreignKeyColumn,
                        operator: 'equals',
                        value: recordData[rel.fromTable === tableName ? rel.fromColumn : rel.toColumn],
                      },
                    ],
                  },
                }),
              });

              if (relatedResponse.ok) {
                const relatedResult = await relatedResponse.json();
                related[card.title] = relatedResult.rows;
              }
            }
          }
          setRelatedData(related);
        }
      } catch (error) {
        console.error('Failed to fetch profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (table) {
      fetchData();
    }
  }, [connection, tableName, schema, recordId, table, profileLayout]);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!recordData) {
    return <div className="p-4">Record not found</div>;
  }

  const getColumnDisplayName = (columnName: string): string => {
    const columnKey = schema
      ? `${schema}.${tableName}.${columnName}`
      : `${tableName}.${columnName}`;
    if (showFriendlyNames && aiAnalysis?.friendlyNames[columnKey]) {
      return aiAnalysis.friendlyNames[columnKey];
    }
    return columnName;
  };

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>
            {showFriendlyNames && aiAnalysis?.friendlyNames[schema ? `${schema}.${tableName}` : tableName]
              ? aiAnalysis.friendlyNames[schema ? `${schema}.${tableName}` : tableName]
              : schema
                ? `${schema}.${tableName}`
                : tableName}
          </CardTitle>
          <CardDescription>Record Details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {table?.columns.map((col) => {
              const value = recordData[col.name];
              return (
                <div key={col.name}>
                  <div className="text-sm font-medium text-muted-foreground">
                    {getColumnDisplayName(col.name)}
                  </div>
                  <div className="text-sm mt-1">
                    {value === null || value === undefined ? (
                      <span className="text-muted-foreground">null</span>
                    ) : (
                      String(value)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {profileLayout && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profileLayout.cards.map((card, index) => (
            <RelationCard
              key={index}
              card={card}
              recordData={recordData}
              relatedData={relatedData[card.title] || []}
              connection={connection}
            />
          ))}
        </div>
      )}
    </div>
  );
}

