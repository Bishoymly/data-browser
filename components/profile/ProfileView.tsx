'use client';

import { useState, useEffect } from 'react';
import type React from 'react';
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

  // Try multiple key formats for profile layout
  const tableKey = schema ? `${schema}.${tableName}` : tableName;
  let profileLayout: ProfileLayout | undefined = aiAnalysis?.profileLayouts[tableKey];
  if (!profileLayout && aiAnalysis?.profileLayouts) {
    // Try without schema
    profileLayout = aiAnalysis.profileLayouts[tableName];
    // Try with just the name part if tableName has dots
    if (!profileLayout && tableName.includes('.')) {
      const nameParts = tableName.split('.');
      profileLayout = aiAnalysis.profileLayouts[nameParts[nameParts.length - 1]];
    }
  }

  // Get schema configuration to filter allowed tables
  const schemaConfig = connection.schemaConfig;
  const isTableAllowed = (tableName: string, tableSchema?: string): boolean => {
    if (!schemaConfig) return true;
    if (schemaConfig.showAll) return true;
    
    const tableKey = tableSchema ? `${tableSchema}.${tableName}` : tableName;
    
    if (schemaConfig.selectedTables) {
      return schemaConfig.selectedTables.includes(tableKey);
    }
    
    if (schemaConfig.selectedSchemas && tableSchema) {
      return schemaConfig.selectedSchemas.includes(tableSchema);
    }
    
    return false;
  };

  // Fetch main record
  useEffect(() => {
    const fetchMainRecord = async () => {
      if (!table || !connection) return;
      
      setLoading(true);
      try {
        const primaryKeyColumn = table.columns.find((c) => c.primaryKey)?.name || 'id';
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
                  column: primaryKeyColumn,
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
      } catch (error) {
        console.error('Failed to fetch profile data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMainRecord();
  }, [connection, tableName, schema, recordId, table]);

  // Fetch related data after main record is loaded
  useEffect(() => {
    const fetchRelatedData = async () => {
      if (!recordData || !table || !connection || !metadata) return;

      const related: Record<string, any[]> = {};

        // Use profile layout if available
        if (profileLayout) {
          console.log('Using profile layout:', {
            tableKey,
            cardsCount: profileLayout.cards.length,
            cardTypes: profileLayout.cards.map(c => c.type),
          });

          for (const card of profileLayout.cards) {
            if (card.type === 'related-table' && card.relationship) {
              const rel = card.relationship;
              const foreignKeyColumn =
                rel.fromTable === tableName ? rel.fromColumn : rel.toColumn;
              const relatedTable = rel.fromTable === tableName ? rel.toTable : rel.fromTable;
              const relatedSchema = rel.fromTable === tableName 
                ? (rel.toSchema || rel.fromSchema)
                : (rel.fromSchema || rel.toSchema);

              // Check if related table is allowed in schema configuration
              if (!isTableAllowed(relatedTable, relatedSchema)) {
                console.log(`Skipping ${relatedSchema ? relatedSchema + '.' : ''}${relatedTable} - not in allowed configuration`);
                continue;
              }

              try {
                const relatedResponse = await fetch('/api/query', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: connection.type,
                    config: connection.config,
                    table: relatedTable,
                    schema: relatedSchema,
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
                  related[card.title] = relatedResult.rows || [];
                }
              } catch (error) {
                console.error(`Error fetching related data for ${card.title}:`, error);
              }
            } else if (card.type === 'aggregate' && card.relationship) {
              // For aggregate cards, fetch all related records
              const rel = card.relationship;
              const foreignKeyColumn =
                rel.fromTable === tableName ? rel.fromColumn : rel.toColumn;
              const relatedTable = rel.fromTable === tableName ? rel.toTable : rel.fromTable;
              const relatedSchema = rel.fromTable === tableName 
                ? (rel.toSchema || rel.fromSchema)
                : (rel.fromSchema || rel.toSchema);

              // Check if related table is allowed in schema configuration
              if (!isTableAllowed(relatedTable, relatedSchema)) {
                console.log(`Skipping aggregate for ${relatedSchema ? relatedSchema + '.' : ''}${relatedTable} - not in allowed configuration`);
                continue;
              }

              try {
                const relatedResponse = await fetch('/api/query', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: connection.type,
                    config: connection.config,
                    table: relatedTable,
                    schema: relatedSchema,
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
                  related[card.title] = relatedResult.rows || [];
                }
              } catch (error) {
                console.error(`Error fetching aggregate data for ${card.title}:`, error);
              }
            }
          }
        } else {
          console.log('No profile layout found for:', tableKey, 'Available layouts:', Object.keys(aiAnalysis?.profileLayouts || {}));
          
          // Fallback: Show related tables based on detected relationships
        // BUT only show tables that are in the allowed schema configuration
        const relationships = metadata.relationships.filter(rel => {
          // Check if this relationship involves the current table
          const involvesCurrentTable = 
            (rel.fromTable === tableName && rel.fromSchema === schema) ||
            (rel.toTable === tableName && rel.toSchema === schema);
          
          if (!involvesCurrentTable) return false;
          
          // Check if the related table is in the allowed configuration
          const isFromTable = rel.fromTable === tableName && rel.fromSchema === schema;
          const relatedTable = isFromTable ? rel.toTable : rel.fromTable;
          const relatedSchema = isFromTable ? rel.toSchema : rel.fromSchema;
          
          return isTableAllowed(relatedTable, relatedSchema);
        });

        for (const rel of relationships) {
          const isFromTable = rel.fromTable === tableName && rel.fromSchema === schema;
          const relatedTable = isFromTable ? rel.toTable : rel.fromTable;
          const relatedSchema = isFromTable ? rel.toSchema : rel.fromSchema;
          const foreignKeyColumn = isFromTable ? rel.toColumn : rel.fromColumn;
          const localKeyColumn = isFromTable ? rel.fromColumn : rel.toColumn;

          // Get the value from the current record
          const foreignKeyValue = recordData[localKeyColumn];
          if (foreignKeyValue === null || foreignKeyValue === undefined) continue;

          try {
            const relatedResponse = await fetch('/api/query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: connection.type,
                config: connection.config,
                table: relatedTable,
                schema: relatedSchema,
                options: {
                  filters: [
                    {
                      column: foreignKeyColumn,
                      operator: 'equals',
                      value: foreignKeyValue,
                    },
                  ],
                },
              }),
            });

            if (relatedResponse.ok) {
              const relatedResult = await relatedResponse.json();
              const relatedTableKey = relatedSchema 
                ? `${relatedSchema}.${relatedTable}` 
                : relatedTable;
              related[relatedTableKey] = relatedResult.rows || [];
            }
          } catch (error) {
            console.error(`Error fetching related data for ${relatedTable}:`, error);
          }
        }
      }

      setRelatedData(related);
    };

    fetchRelatedData();
  }, [recordData, table, connection, metadata, profileLayout, tableName, schema]);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (!recordData) {
    return <div className="p-4">Record not found</div>;
  }

  const getColumnDisplayName = (columnName: string): string => {
    if (showFriendlyNames && aiAnalysis?.friendlyNames) {
      // Try multiple key formats
      const columnKey = schema
        ? `${schema}.${tableName}.${columnName}`
        : `${tableName}.${columnName}`;
      
      let friendlyName = aiAnalysis.friendlyNames[columnKey];
      // Try without schema
      if (!friendlyName && schema) {
        friendlyName = aiAnalysis.friendlyNames[`${tableName}.${columnName}`];
      }
      // Try just column name
      if (!friendlyName) {
        friendlyName = aiAnalysis.friendlyNames[columnName];
      }
      
      if (friendlyName) {
        return friendlyName;
      }
    }
    return columnName;
  };

  const formatValue = (value: any, columnName: string): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">null</span>;
    }

    const columnKey = schema
      ? `${schema}.${tableName}.${columnName}`
      : `${tableName}.${columnName}`;
    const config = aiAnalysis?.columnConfigs[columnKey];
    const format = config?.displayFormat;

    switch (format) {
      case 'date':
        try {
          const date = new Date(value);
          return date.toLocaleDateString();
        } catch {
          return String(value);
        }
      case 'datetime':
        try {
          const date = new Date(value);
          return date.toLocaleString();
        } catch {
          return String(value);
        }
      case 'currency':
        try {
          const num = typeof value === 'string' ? parseFloat(value) : value;
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(num);
        } catch {
          return String(value);
        }
      case 'number':
        try {
          const num = typeof value === 'string' ? parseFloat(value) : value;
          return new Intl.NumberFormat('en-US').format(num);
        } catch {
          return String(value);
        }
      case 'boolean':
        return value ? 'Yes' : 'No';
      case 'email':
        return (
          <a href={`mailto:${value}`} className="text-primary hover:underline">
            {String(value)}
          </a>
        );
      case 'url':
        return (
          <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            {String(value)}
          </a>
        );
      default:
        return String(value);
    }
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
                    {formatValue(value, col.name)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {(profileLayout || Object.keys(relatedData).length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {profileLayout ? (
            // Use AI-generated profile layout
            profileLayout.cards.map((card, index) => {
              // Determine related table name and schema for navigation
              let relatedTableName = card.table || card.title;
              let relatedSchema: string | undefined = undefined;
              
              if (card.relationship) {
                const rel = card.relationship;
                const isFromTable = rel.fromTable === tableName && rel.fromSchema === schema;
                relatedTableName = isFromTable ? rel.toTable : rel.fromTable;
                relatedSchema = isFromTable ? rel.toSchema : rel.fromSchema;
              }

              return (
                <RelationCard
                  key={index}
                  card={card}
                  recordData={recordData}
                  relatedData={relatedData[card.title] || []}
                  connection={connection}
                  tableName={relatedTableName}
                  schema={relatedSchema}
                />
              );
            })
          ) : (
            // Fallback: Show all related tables based on detected relationships
            Object.entries(relatedData).map(([relatedTableKey, rows]) => {
              const parts = relatedTableKey.split('.');
              const relatedSchema = parts.length > 1 ? parts[0] : undefined;
              const relatedTable = parts.length > 1 ? parts.slice(1).join('.') : parts[0];
              
              return (
                <RelationCard
                  key={relatedTableKey}
                  card={{
                    type: 'related-table',
                    title: relatedSchema 
                      ? `${relatedSchema}.${relatedTable}` 
                      : relatedTable,
                    columns: undefined,
                  }}
                  recordData={recordData}
                  relatedData={rows}
                  connection={connection}
                  tableName={relatedTable}
                  schema={relatedSchema}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

