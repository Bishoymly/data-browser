'use client';

import type React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileCard } from '@/types/schema';
import { ConnectionConfig } from '@/types/config';
import { useSchemaStore } from '@/stores/schema-store';
import { useUIStore } from '@/stores/ui-store';
import { useProfileModalStore } from '@/stores/profile-modal-store';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RelationCardProps {
  card: ProfileCard;
  recordData: any;
  relatedData: any[];
  connection: ConnectionConfig;
  tableName?: string;
  schema?: string;
  lookupMaps?: Record<string, Map<any, string>>;
}

export function RelationCard({ card, recordData, relatedData, tableName, schema, lookupMaps = {} }: RelationCardProps) {
  const { metadata, aiAnalysis } = useSchemaStore();
  const { showFriendlyNames } = useUIStore();
  const { openModal } = useProfileModalStore();

  // Get friendly name for a column (for fields card - uses current table context)
  const getColumnDisplayNameForFields = (colName: string): string => {
    const tableKey = schema ? `${schema}.${tableName}` : tableName;
    const columnKey = tableKey ? `${tableKey}.${colName}` : colName;
    
    if (showFriendlyNames && aiAnalysis?.friendlyNames) {
      let friendlyName = aiAnalysis.friendlyNames[columnKey];
      if (!friendlyName && schema) {
        friendlyName = aiAnalysis.friendlyNames[`${tableName}.${colName}`];
      }
      if (!friendlyName) {
        friendlyName = aiAnalysis.friendlyNames[colName];
      }
      if (friendlyName) {
        return friendlyName;
      }
    }
    return colName;
  };

  // Format value for fields card (uses current table context)
  const formatValueForFields = (value: any, colName: string): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">null</span>;
    }

    const tableKey = schema ? `${schema}.${tableName}` : tableName;
    const columnKey = tableKey ? `${tableKey}.${colName}` : colName;
    
    // Try multiple key formats for column configs
    let config = aiAnalysis?.columnConfigs[columnKey];
    if (!config && aiAnalysis?.columnConfigs) {
      config = aiAnalysis.columnConfigs[`${tableName}.${colName}`] || 
               aiAnalysis.columnConfigs[colName] || 
               undefined;
    }
    
    // Handle lookup values if configured
    if (config?.lookupTable && value !== null && value !== undefined) {
      const lookupMap = lookupMaps[colName];
      
      // Get lookup table schema
      const lookupTableParts = config.lookupTable.split('.');
      let lookupTableName = lookupTableParts.length > 1 
        ? lookupTableParts.slice(1).join('.')
        : lookupTableParts[0];
      let lookupTableSchema = lookupTableParts.length > 1 ? lookupTableParts[0] : undefined;
      
      // Try to find schema from foreign key relationships
      const relatedTable = metadata?.tables.find(
        (t) => t.name === (card.type === 'fields' ? tableName : (card.table || tableName || '')) && 
               ((card.type === 'fields' ? schema : (schema || undefined)) ? t.schema === (card.type === 'fields' ? schema : schema) : !t.schema)
      );
      const col = relatedTable?.columns.find(c => c.name === colName);
      const fk = col?.foreignKey;
      if (fk && fk.referencedTable === lookupTableName) {
        lookupTableSchema = fk.referencedSchema;
      }
      
      // If no schema provided, try to find it in metadata
      if (!lookupTableSchema && metadata) {
        const foundTable = metadata.tables.find(t => 
          t.name === lookupTableName || 
          t.name.toLowerCase() === lookupTableName.toLowerCase()
        );
        if (foundTable && foundTable.schema) {
          lookupTableSchema = foundTable.schema;
        }
      }
      
      // Try current table's schema
      if (!lookupTableSchema && schema) {
        const foundTable = metadata?.tables.find(t => 
          t.name === lookupTableName && t.schema === schema
        );
        if (foundTable) {
          lookupTableSchema = schema;
        }
      }
      
      const lookupTableKey = lookupTableSchema 
        ? `${lookupTableSchema}.${lookupTableName}` 
        : lookupTableName;
      const lookupProfileUrl = `/profile/${encodeURIComponent(lookupTableKey)}/${encodeURIComponent(String(value))}`;
      
      if (lookupMap && lookupMap.has(value)) {
        const displayValue = lookupMap.get(value);
        return (
          <button
            type="button"
            onClick={() => openModal(lookupTableName, String(value), lookupTableSchema)}
            className="text-primary bg-primary/5 hover:bg-primary/15 px-2 py-1 rounded transition-colors cursor-pointer inline-block"
            title={`${colName}: ${value} - Click to view profile`}
          >
            {displayValue}
          </button>
        );
      }
      // Fallback: show ID if lookup not loaded yet, but still make it a link
      return (
        <button
          type="button"
          onClick={() => openModal(lookupTableName, String(value), lookupTableSchema)}
            className="text-primary bg-primary/5 hover:bg-primary/15 px-2 py-1 rounded transition-colors cursor-pointer inline-block text-muted-foreground"
          title={`Lookup: ${config.lookupTable} (ID: ${value}) - Click to view profile`}
        >
          {String(value)}
        </button>
      );
    }
    
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

  if (card.type === 'fields' && card.columns) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{card.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {card.columns.map((col) => (
              <div key={col}>
                <div className="text-sm font-medium text-muted-foreground">
                  {getColumnDisplayNameForFields(col)}
                </div>
                <div className="text-sm">
                  {formatValueForFields(recordData[col], col)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (card.type === 'related-table') {
    // Get related table metadata
    const relatedTableName = card.table || tableName || '';
    const relatedTableSchema = schema;
    const relatedSchema = relatedTableSchema; // Alias for clarity
    const relatedTable = metadata?.tables.find(
      (t) => t.name === relatedTableName && (relatedTableSchema ? t.schema === relatedTableSchema : !t.schema)
    );

    // Get primary key column for navigation
    const getRecordId = (row: any): string => {
      if (relatedTable) {
        const primaryKeyColumns = relatedTable.columns.filter(col => col.primaryKey).map(col => col.name);
        if (primaryKeyColumns.length > 0) {
          const id = primaryKeyColumns.map(col => row[col]).join('|');
          return encodeURIComponent(id);
        }
      }
      // Fallback: try common ID column names
      const idColumns = ['id', 'Id', 'ID', `${relatedTableName}Id`, `${relatedTableName}_id`];
      for (const col of idColumns) {
        if (row[col] !== null && row[col] !== undefined) {
          return encodeURIComponent(String(row[col]));
        }
      }
      // Fallback to first column value
      const firstCol = Object.keys(row)[0];
      return firstCol ? encodeURIComponent(String(row[firstCol] || '')) : '';
    };

    // Get columns to display
    const displayColumns = card.columns && card.columns.length > 0 
      ? card.columns 
      : (relatedData.length > 0 ? Object.keys(relatedData[0]) : []);

    // Get friendly name for a column
    const getColumnDisplayName = (colName: string): string => {
      const tableKey = relatedTableSchema ? `${relatedTableSchema}.${relatedTableName}` : relatedTableName;
      const columnKey = tableKey ? `${tableKey}.${colName}` : colName;
      
      if (showFriendlyNames && aiAnalysis?.friendlyNames) {
        let friendlyName = aiAnalysis.friendlyNames[columnKey];
        if (!friendlyName && relatedTableSchema) {
          friendlyName = aiAnalysis.friendlyNames[`${relatedTableName}.${colName}`];
        }
        if (!friendlyName) {
          friendlyName = aiAnalysis.friendlyNames[colName];
        }
        if (friendlyName) {
          return friendlyName;
        }
      }
      return colName;
    };

    // Format value based on column config
    const formatValue = (value: any, colName: string): React.ReactNode => {
      if (value === null || value === undefined) {
        return <span className="text-muted-foreground">null</span>;
      }

      const tableKey = relatedTableSchema ? `${relatedTableSchema}.${relatedTableName}` : relatedTableName;
      const columnKey = tableKey ? `${tableKey}.${colName}` : colName;
      const config = aiAnalysis?.columnConfigs[columnKey] || 
                     aiAnalysis?.columnConfigs[`${relatedTableName}.${colName}`] ||
                     aiAnalysis?.columnConfigs[colName];

      // Handle lookup values if configured
      if (config?.lookupTable && value !== null && value !== undefined) {
        // Get lookup table schema
        const lookupTableParts = config.lookupTable.split('.');
        let lookupTableName = lookupTableParts.length > 1 
          ? lookupTableParts.slice(1).join('.')
          : lookupTableParts[0];
        let lookupTableSchema = lookupTableParts.length > 1 ? lookupTableParts[0] : undefined;
        
        // Try to find schema from foreign key relationships
        const col = relatedTable?.columns.find(c => c.name === colName);
        const fk = col?.foreignKey;
        if (fk && fk.referencedTable === lookupTableName) {
          lookupTableSchema = fk.referencedSchema;
        }
        
        // If no schema provided, try to find it in metadata
        if (!lookupTableSchema && metadata) {
          const foundTable = metadata.tables.find(t => 
            t.name === lookupTableName || 
            t.name.toLowerCase() === lookupTableName.toLowerCase()
          );
          if (foundTable && foundTable.schema) {
            lookupTableSchema = foundTable.schema;
          }
        }
        
        // Try current table's schema
        if (!lookupTableSchema && relatedTableSchema) {
          const foundTable = metadata?.tables.find(t => 
            t.name === lookupTableName && t.schema === relatedTableSchema
          );
          if (foundTable) {
            lookupTableSchema = relatedTableSchema;
          }
        }
        
        // Note: lookupMaps are not available in related-table context, so we'll just show the ID as a link
        return (
          <button
            type="button"
            onClick={() => openModal(lookupTableName, String(value), lookupTableSchema)}
            className="text-primary bg-primary/5 hover:bg-primary/15 px-2 py-1 rounded transition-colors cursor-pointer inline-block"
            title={`Lookup: ${config.lookupTable} (ID: ${value}) - Click to view profile`}
          >
            {String(value)}
          </button>
        );
      }

      switch (config?.displayFormat) {
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

    const relatedTableKey = relatedTableSchema 
      ? `${relatedTableSchema}.${relatedTableName}` 
      : relatedTableName;

    return (
      <Card>
        <CardHeader>
          <CardTitle>{card.title}</CardTitle>
          <CardDescription>
            {relatedData.length} related record{relatedData.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {relatedData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No related records</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {displayColumns.map((col) => (
                      <TableHead key={col} className="font-medium">
                        {getColumnDisplayName(col)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatedData.slice(0, 20).map((row, index) => {
                    const recordId = getRecordId(row);

                    return (
                      <TableRow key={index}>
                        {displayColumns.map((col, colIndex) => {
                          const isFirstColumn = colIndex === 0;
                          const cellContent = formatValue(row[col], col);
                          
                          return (
                            <TableCell key={col} className="text-sm">
                              {isFirstColumn && recordId ? (
                                <button
                                  type="button"
                                  onClick={() => openModal(relatedTableName, recordId, relatedTableSchema)}
                                  className="text-primary bg-primary/5 hover:bg-primary/15 px-2 py-1 rounded transition-colors cursor-pointer inline-block"
                                  title="Click to view profile"
                                >
                                  {cellContent}
                                </button>
                              ) : (
                                cellContent
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {relatedData.length > 20 && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  +{relatedData.length - 20} more records
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (card.type === 'aggregate') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{card.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {card.aggregateType === 'count'
              ? relatedData.length
              : card.aggregateColumn
                ? relatedData.reduce((sum, row) => sum + (Number(row[card.aggregateColumn!]) || 0), 0)
                : 0}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}

