'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ColumnSelector } from './ColumnSelector';
import { useConnectionStore } from '@/stores/connection-store';
import { useSchemaStore } from '@/stores/schema-store';
import { useUIStore } from '@/stores/ui-store';
import { useProfileModalStore } from '@/stores/profile-modal-store';
import { DatabaseType } from '@/types/database';
import { Column as SchemaColumn } from '@/types/schema';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown, X, Filter } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DataGridProps {
  tableName: string;
  schema?: string;
}

export function DataGrid({ tableName, schema }: DataGridProps) {
  const { getActiveConnection } = useConnectionStore();
  const { metadata, aiAnalysis } = useSchemaStore();
  const { showFriendlyNames } = useUIStore();
  const { openModal } = useProfileModalStore();

  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<SchemaColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [pageSize, setPageSize] = useState(50);
  const [pageIndex, setPageIndex] = useState(0);
  const [lookupMaps, setLookupMaps] = useState<Record<string, Map<any, string>>>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [pendingGlobalFilter, setPendingGlobalFilter] = useState('');
  const [pendingFilters, setPendingFilters] = useState<Record<string, string>>({});
  const filterTimeoutsRef = React.useRef<Record<string, NodeJS.Timeout>>({});
  const globalFilterTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const connection = getActiveConnection();

  // Get table info
  const tableInfo = useMemo(() => {
    if (!metadata) return null;
    return metadata.tables.find(
      (t) =>
        t.name === tableName &&
        (schema ? t.schema === schema : !t.schema)
    ) || null;
  }, [metadata, tableName, schema]);

  // Get table columns
  useEffect(() => {
    if (tableInfo) {
      setColumns(tableInfo.columns);
    }
  }, [tableInfo]);

  // Find primary key column(s)
  const primaryKeyColumns = useMemo(() => {
    if (!tableInfo) return [];
    return tableInfo.columns.filter(col => col.primaryKey).map(col => col.name);
  }, [tableInfo]);

  // Get record ID for navigation (use first primary key, or first column if no PK)
  const getRecordId = (row: any): string => {
    if (primaryKeyColumns.length > 0) {
      // Use primary key(s) - if multiple, join them
      const id = primaryKeyColumns.map(col => row[col]).join('|');
      return encodeURIComponent(id);
    }
    // Fallback to first column value
    const firstCol = columns[0]?.name;
    return firstCol ? encodeURIComponent(String(row[firstCol] || '')) : '';
  };


  // Fetch data
  useEffect(() => {
    if (!connection || !metadata || columns.length === 0) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const currentPage = pageIndex + 1;
        const requestBody = {
          type: connection.type,
          config: connection.config,
          table: tableName,
          schema,
          options: {
            sorts: sorting.map((s) => ({
              column: s.id,
              direction: s.desc ? 'desc' : 'asc',
            })),
            filters: columnFilters.map((f) => ({
              column: f.id,
              operator: 'contains',
              value: f.value,
            })),
            pagination: {
              page: currentPage,
              pageSize,
            },
          },
        };

        console.log('Fetching table data:', {
          table: tableName,
          schema,
          page: currentPage,
          pageSize,
        });

        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }

        console.log('Data received:', {
          rows: result.rows?.length || 0,
          totalCount: result.rowCount,
          columns: result.columns?.length || 0,
        });

        setData(result.rows || []);
        setTotalRows(result.rowCount || 0);
      } catch (err: any) {
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [connection, tableName, schema, sorting, columnFilters, pageSize, pageIndex, columns.length]);

  // Fetch lookup values for columns that have lookup configurations
  const fetchLookupValues = async (rows: any[], cols: SchemaColumn[]) => {
    if (!connection || !aiAnalysis || !metadata || rows.length === 0) return;

    const lookupMapsToFetch: Record<string, {
      lookupTable: string;
      lookupSchema?: string;
      lookupColumn: string;
      lookupDisplayColumn: string;
      columnName: string;
    }> = {};

    // Identify columns with lookup configurations
    cols.forEach((col) => {
      const columnKey = schema ? `${schema}.${tableName}.${col.name}` : `${tableName}.${col.name}`;
      const config = aiAnalysis.columnConfigs[columnKey] || 
                     aiAnalysis.columnConfigs[`${tableName}.${col.name}`] ||
                     aiAnalysis.columnConfigs[col.name];
      
      if (config?.lookupTable && config.lookupColumn && config.lookupDisplayColumn) {
        // Parse lookup table name (might include schema)
        const lookupTableParts = config.lookupTable.split('.');
        let lookupTableName = lookupTableParts.length > 1 
          ? lookupTableParts.slice(1).join('.')
          : lookupTableParts[0];
        let lookupTableSchema = lookupTableParts.length > 1 ? lookupTableParts[0] : undefined;

        // If no schema provided, try multiple strategies to find it:
        
        // 1. Check foreign key relationship for this column
        if (!lookupTableSchema && col.foreignKey) {
          lookupTableSchema = col.foreignKey.referencedSchema;
          // Also verify the table name matches
          if (col.foreignKey.referencedTable !== lookupTableName) {
            // Foreign key might point to a different table, but use its schema as hint
            const fkTable = metadata?.tables.find(t => 
              t.name === col.foreignKey!.referencedTable &&
              (col.foreignKey!.referencedSchema ? t.schema === col.foreignKey!.referencedSchema : true)
            );
            if (fkTable && fkTable.schema) {
              // Check if lookup table exists in same schema as FK table
              const lookupInSameSchema = metadata?.tables.find(t => 
                t.name === lookupTableName && t.schema === fkTable.schema
              );
              if (lookupInSameSchema) {
                lookupTableSchema = fkTable.schema;
              }
            }
          }
        }

        // 2. Try to find it in metadata by name (case-insensitive)
        if (!lookupTableSchema && metadata) {
          const foundTable = metadata.tables.find(t => 
            t.name === lookupTableName || 
            t.name.toLowerCase() === lookupTableName.toLowerCase()
          );
          if (foundTable && foundTable.schema) {
            lookupTableSchema = foundTable.schema;
          }
        }

        // 3. Try current table's schema (many lookup tables are in the same schema)
        if (!lookupTableSchema && schema) {
          const foundTable = metadata?.tables.find(t => 
            t.name === lookupTableName && t.schema === schema
          );
          if (foundTable) {
            lookupTableSchema = schema;
          }
        }

        lookupMapsToFetch[col.name] = {
          lookupTable: lookupTableName,
          lookupSchema: lookupTableSchema,
          lookupColumn: config.lookupColumn,
          lookupDisplayColumn: config.lookupDisplayColumn,
          columnName: col.name,
        };
      }
    });

    if (Object.keys(lookupMapsToFetch).length === 0) return;

    // Fetch lookup values for each lookup column
    const newLookupMaps: Record<string, Map<any, string>> = {};
    
    for (const [columnName, lookupConfig] of Object.entries(lookupMapsToFetch)) {
      try {
        // Collect unique IDs from the current page data
        const uniqueIds = new Set<any>();
        rows.forEach(row => {
          const id = row[columnName];
          if (id !== null && id !== undefined) {
            uniqueIds.add(id);
          }
        });

        if (uniqueIds.size === 0) continue;

        // Fetch lookup values using IN operator for multiple IDs
        console.log('Fetching lookup values:', {
          table: lookupConfig.lookupTable,
          schema: lookupConfig.lookupSchema,
          column: lookupConfig.lookupColumn,
          displayColumn: lookupConfig.lookupDisplayColumn,
          idsCount: uniqueIds.size,
        });

        const lookupResponse = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: connection.type,
            config: connection.config,
            table: lookupConfig.lookupTable,
            schema: lookupConfig.lookupSchema,
            options: {
              filters: [{
                column: lookupConfig.lookupColumn,
                operator: 'in',
                value: Array.from(uniqueIds),
              }],
            },
          }),
        });

        if (lookupResponse.ok) {
          const lookupResult = await lookupResponse.json();
          const lookupMap = new Map<any, string>();
          
          // Build map of ID -> display value
          lookupResult.rows?.forEach((row: any) => {
            const id = row[lookupConfig.lookupColumn];
            const displayValue = row[lookupConfig.lookupDisplayColumn];
            if (id !== null && id !== undefined && displayValue !== null && displayValue !== undefined) {
              lookupMap.set(id, String(displayValue));
            }
          });

          newLookupMaps[columnName] = lookupMap;
        }
      } catch (error) {
        console.error(`Error fetching lookup values for ${columnName}:`, error);
      }
    }

    setLookupMaps(newLookupMaps);
  };

  // Fetch lookup values after data is loaded
  useEffect(() => {
    if (data.length > 0 && columns.length > 0 && aiAnalysis && connection) {
      fetchLookupValues(data, columns);
    }
  }, [data, columns, aiAnalysis, connection, tableName, schema]);

  // Format value based on display format
  const formatValue = (value: any, format?: string): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground">null</span>;
    }

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

  // Filter input for each column - moved before tableColumns useMemo so it's available in header
  const getColumnFilterValue = (columnId: string) => {
    return columnFilters.find(f => f.id === columnId)?.value as string || '';
  };

  const setColumnFilterValue = (columnId: string, value: string) => {
    setColumnFilters(prev => {
      const existing = prev.findIndex(f => f.id === columnId);
      if (value === '') {
        // Remove filter if empty
        return prev.filter(f => f.id !== columnId);
      }
      if (existing >= 0) {
        // Update existing filter
        return prev.map((f, i) => i === existing ? { ...f, value } : f);
      }
      // Add new filter
      return [...prev, { id: columnId, value }];
    });
  };

  // Debounced filter update
  const setColumnFilterValueDebounced = (columnId: string, value: string) => {
    // Update pending filter immediately for UI responsiveness
    setPendingFilters(prev => ({
      ...prev,
      [columnId]: value,
    }));

    // Clear existing timeout for this column
    if (filterTimeoutsRef.current[columnId]) {
      clearTimeout(filterTimeoutsRef.current[columnId]);
    }

    // Set new timeout to update actual filter after delay
    filterTimeoutsRef.current[columnId] = setTimeout(() => {
      setColumnFilterValue(columnId, value);
      // Clear pending filter after applying
      setPendingFilters(prev => {
        const updated = { ...prev };
        delete updated[columnId];
        return updated;
      });
      delete filterTimeoutsRef.current[columnId];
    }, 500); // 500ms delay
  };

  // Debounced global filter update - will be defined after table is created
  const setGlobalFilterDebouncedRef = React.useRef<((value: string) => void) | null>(null);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      Object.values(filterTimeoutsRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
      if (globalFilterTimeoutRef.current) {
        clearTimeout(globalFilterTimeoutRef.current);
      }
    };
  }, []);

  // Build table columns
  const tableColumns = useMemo<ColumnDef<any>[]>(() => {
    // Get important columns for default visibility and ordering
    const tableKey = schema ? `${schema}.${tableName}` : tableName;
    const importantCols = aiAnalysis?.importantColumns[tableKey] || [];
    
    // Get saved column order from preferences
    const savedColumnOrder = connection?.uiPreferences?.columnOrder[tableKey];
    
    // Sort columns based on order preference or important columns order
    const sortedColumns = [...columns].sort((a, b) => {
      // First priority: saved column order
      if (savedColumnOrder) {
        const aIndex = savedColumnOrder.indexOf(a.name);
        const bIndex = savedColumnOrder.indexOf(b.name);
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        if (aIndex !== -1) return -1; // a is in order, b is not
        if (bIndex !== -1) return 1;  // b is in order, a is not
      }
      
      // Second priority: important columns order
      if (importantCols.length > 0) {
        const aIndex = importantCols.indexOf(a.name);
        const bIndex = importantCols.indexOf(b.name);
        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        }
        if (aIndex !== -1) return -1; // a is important, b is not
        if (bIndex !== -1) return 1;  // b is important, a is not
      }
      
      // Third priority: isImportant flag from config
      const aConfig = aiAnalysis?.columnConfigs[`${tableKey}.${a.name}`] || 
                      aiAnalysis?.columnConfigs[`${tableName}.${a.name}`] ||
                      aiAnalysis?.columnConfigs[a.name];
      const bConfig = aiAnalysis?.columnConfigs[`${tableKey}.${b.name}`] || 
                      aiAnalysis?.columnConfigs[`${tableName}.${b.name}`] ||
                      aiAnalysis?.columnConfigs[b.name];
      
      if (aConfig?.isImportant && !bConfig?.isImportant) return -1;
      if (!aConfig?.isImportant && bConfig?.isImportant) return 1;
      
      // Keep original order if no ordering preference
      return 0;
    });
    
    return sortedColumns.map((col, colIndex) => {
      const columnKey = schema ? `${schema}.${tableName}.${col.name}` : `${tableName}.${col.name}`;
      const isFirstColumn = colIndex === 0;
      const isPrimaryKey = col.primaryKey; // Check if it's a primary key column
      
      // Try multiple key formats for friendly names (AI might use different formats)
      let friendlyName = col.name;
      if (showFriendlyNames && aiAnalysis?.friendlyNames) {
        // Try: schema.tableName.columnName
        friendlyName = aiAnalysis.friendlyNames[columnKey] || friendlyName;
        // Try: tableName.columnName (without schema)
        if (friendlyName === col.name) {
          friendlyName = aiAnalysis.friendlyNames[`${tableName}.${col.name}`] || friendlyName;
        }
        // Try: just columnName
        if (friendlyName === col.name) {
          friendlyName = aiAnalysis.friendlyNames[col.name] || friendlyName;
        }
      }
      
      // Try multiple key formats for column configs too
      let config = aiAnalysis?.columnConfigs[columnKey];
      if (!config && aiAnalysis?.columnConfigs) {
        config = aiAnalysis.columnConfigs[`${tableName}.${col.name}`] || 
                 aiAnalysis.columnConfigs[col.name] || 
                 undefined;
      }
      
      // Determine if column should be visible by default
      const isImportant = importantCols.length > 0 
        ? importantCols.includes(col.name)
        : config?.isImportant ?? false;

      return {
        accessorKey: col.name,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          const columnFilterValue = getColumnFilterValue(column.id);
          const pendingValue = pendingFilters[column.id];
          const displayValue = pendingValue !== undefined ? pendingValue : columnFilterValue;
          const hasFilter = !!columnFilterValue || !!pendingValue;
          
          return (
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <span className="truncate">{friendlyName}</span>
                {column.getCanSort() && (
                  <span className="inline-flex items-center flex-shrink-0">
                    {isSorted === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : isSorted === 'desc' ? (
                      <ArrowDown className="h-4 w-4" />
                    ) : (
                      <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </span>
                )}
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={`flex-shrink-0 p-1 rounded hover:bg-muted transition-colors ${
                      hasFilter ? 'text-primary' : 'text-muted-foreground'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                    title={hasFilter ? `Filter: ${displayValue}` : 'Add filter'}
                  >
                    <Filter className={`h-4 w-4 ${hasFilter ? 'fill-current' : ''}`} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64" onClick={(e) => e.stopPropagation()}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Filter {friendlyName}</label>
                    <Input
                      placeholder={`Filter ${friendlyName}...`}
                      value={displayValue}
                      onChange={(e) => {
                        setColumnFilterValueDebounced(column.id, e.target.value);
                      }}
                      autoFocus
                    />
                    {hasFilter && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          // Clear timeout if exists
                          if (filterTimeoutsRef.current[column.id]) {
                            clearTimeout(filterTimeoutsRef.current[column.id]);
                            delete filterTimeoutsRef.current[column.id];
                          }
                          // Clear pending filter
                          setPendingFilters(prev => {
                            const updated = { ...prev };
                            delete updated[column.id];
                            return updated;
                          });
                          // Clear actual filter
                          setColumnFilterValue(column.id, '');
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Clear Filter
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          );
        },
        cell: ({ getValue, row }) => {
          const value = getValue();
          
          // Try multiple key formats for column configs
          let config = aiAnalysis?.columnConfigs[columnKey];
          if (!config && aiAnalysis?.columnConfigs) {
            config = aiAnalysis.columnConfigs[`${tableName}.${col.name}`] || 
                     aiAnalysis.columnConfigs[col.name] || 
                     undefined;
          }
          
          // Handle lookup values if configured
          if (config?.lookupTable && value !== null && value !== undefined) {
            const lookupMap = lookupMaps[col.name];
            
            // Get lookup table schema (same logic as in fetchLookupValues)
            const lookupTableParts = config.lookupTable.split('.');
            let lookupTableName = lookupTableParts.length > 1 
              ? lookupTableParts.slice(1).join('.')
              : lookupTableParts[0];
            let lookupTableSchema = lookupTableParts.length > 1 ? lookupTableParts[0] : undefined;
            
            // Try to find schema from foreign key relationships
            const fk = col.foreignKey;
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
              const cellContent = (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal(lookupTableName, String(value), lookupTableSchema);
                  }}
                  className="text-primary bg-primary/5 hover:bg-primary/15 px-2 py-1 rounded transition-colors cursor-pointer inline-block"
                  title={`${col.name}: ${value} - Click to view profile`}
                >
                  {displayValue}
                </button>
              );
              
              // Make first column or primary key column a link (to current record's profile)
              if (isFirstColumn || isPrimaryKey) {
                const recordId = getRecordId(row.original);
                return (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal(tableName, recordId, schema);
                    }}
                    className="text-primary bg-primary/5 hover:bg-primary/15 px-2 py-1 rounded transition-colors cursor-pointer inline-block"
                    title="Click to view profile"
                  >
                    {cellContent}
                  </button>
                );
              }
              
              return cellContent;
            }
            // Fallback: show ID if lookup not loaded yet, but still make it a link
            const fallbackContent = (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openModal(lookupTableName, String(value), lookupTableSchema);
                }}
                className="text-primary bg-primary/5 hover:bg-primary/15 px-2 py-1 rounded transition-colors cursor-pointer inline-block text-muted-foreground"
                title={`Lookup: ${config.lookupTable} (ID: ${value}) - Click to view profile`}
              >
                {String(value)}
              </button>
            );
            
            // Make first column or primary key column a link (to current record's profile)
            if (isFirstColumn || isPrimaryKey) {
              const recordId = getRecordId(row.original);
              return (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openModal(tableName, recordId, schema);
                  }}
                  className="text-primary bg-primary/5 hover:bg-primary/15 px-2 py-1 rounded transition-colors cursor-pointer inline-block"
                  title="Click to view profile"
                >
                  {fallbackContent}
                </button>
              );
            }
            
            return fallbackContent;
          }
          
          // Apply display format
          const formattedValue = formatValue(value, config?.displayFormat);
          
          // Make first column or primary key column a link
          if (isFirstColumn || isPrimaryKey) {
            const recordId = getRecordId(row.original);
            
            // If formattedValue is already a React element (like email/url links), 
            // show it as-is but make the raw value clickable for profile
            if (React.isValidElement(formattedValue)) {
              // Show the formatted element (email/url link) and add profile link separately
              return (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal(tableName, recordId, schema);
                    }}
                    className="text-primary bg-primary/5 hover:bg-primary/15 px-2 py-1 rounded transition-colors cursor-pointer inline-block"
                    title="Click to view profile"
                  >
                    {String(value)}
                  </button>
                  <span className="text-muted-foreground">|</span>
                  {formattedValue}
                </span>
              );
            }
            
            // For non-element values (strings, numbers), wrap in profile link
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openModal(tableName, recordId, schema);
                }}
                className="text-primary bg-primary/5 hover:bg-primary/15 px-2 py-1 rounded transition-colors cursor-pointer inline-block"
                title="Click to view profile"
              >
                {formattedValue}
              </button>
            );
          }
          
          return formattedValue;
        },
        enableSorting: true,
        enableHiding: true,
        // Set default visibility based on importance
        ...(importantCols.length > 0 && {
          meta: {
            defaultVisible: isImportant,
          },
        }),
      };
    });
  }, [columns, showFriendlyNames, aiAnalysis, schema, tableName, lookupMaps]);

  // Set initial column visibility based on important columns or saved preferences
  useEffect(() => {
    if (aiAnalysis && tableColumns.length > 0 && connection) {
      const tableKey = schema ? `${schema}.${tableName}` : tableName;
      const importantCols = aiAnalysis.importantColumns[tableKey] || [];
      const savedHiddenColumns = connection.uiPreferences?.hiddenColumns[tableKey] || [];
      
      // Build visibility state
      const initialVisibility: VisibilityState = {};
      
      if (importantCols.length > 0) {
        // Use important columns: show only important ones
        columns.forEach((col) => {
          initialVisibility[col.name] = importantCols.includes(col.name);
        });
      } else {
        // No important columns defined: show all except saved hidden ones
        columns.forEach((col) => {
          initialVisibility[col.name] = !savedHiddenColumns.includes(col.name);
        });
      }
      
      // Override with saved hidden columns (user preferences take precedence)
      savedHiddenColumns.forEach((colName) => {
        initialVisibility[colName] = false;
      });
      
      setColumnVisibility(initialVisibility);
    }
  }, [aiAnalysis, tableName, schema, tableColumns.length, columns, connection]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    enableColumnFilters: true,
    enableGlobalFilter: false, // We handle global filter manually
    manualFiltering: true, // Server-side filtering
    manualSorting: true, // Server-side sorting
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    initialState: {
      pagination: {
        pageSize,
        pageIndex,
      },
    },
    manualPagination: true,
    pageCount: Math.ceil(totalRows / pageSize),
    onPaginationChange: (updater) => {
      if (typeof updater === 'function') {
        setPageIndex(updater({ pageIndex, pageSize }).pageIndex);
      } else {
        setPageIndex(updater.pageIndex);
      }
    },
  });

  if (!connection || !metadata) {
    return <div className="p-4">No connection or schema available</div>;
  }

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return <div className="p-4 text-destructive">Error: {error}</div>;
  }


  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            {/* Global filter */}
            <div className="relative flex-1 max-w-sm">
              <Input
                placeholder="Search all columns..."
                value={pendingGlobalFilter !== undefined ? pendingGlobalFilter : globalFilter}
                onChange={(e) => {
                  if (setGlobalFilterDebouncedRef.current) {
                    setGlobalFilterDebouncedRef.current(e.target.value);
                  }
                }}
                className="pl-8"
              />
              {(globalFilter || pendingGlobalFilter) && (
                <button
                  onClick={() => {
                    if (globalFilterTimeoutRef.current) {
                      clearTimeout(globalFilterTimeoutRef.current);
                      globalFilterTimeoutRef.current = null;
                    }
                    setPendingGlobalFilter('');
                    setGlobalFilter('');
                    setColumnFilters([]);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <ColumnSelector
              columns={columns}
              table={table}
              tableName={tableName}
              schema={schema}
            />
          </div>
          {/* Active filters indicator */}
          {columnFilters.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {columnFilters.length} filter{columnFilters.length !== 1 ? 's' : ''} active
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setColumnFilters([]);
                  setGlobalFilter('');
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            </div>
          )}
        </div>

        {/* Column-specific filters */}
        {columnFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-md">
            {table.getVisibleLeafColumns()
              .filter(column => columnFilters.some(f => f.id === column.id))
              .map(column => {
                const filterValue = getColumnFilterValue(column.id);
                return (
                  <div key={column.id} className="flex items-center gap-1 px-2 py-1 bg-background rounded border">
                    <span className="text-sm font-medium">{column.columnDef.header as string}:</span>
                    <Input
                      value={filterValue}
                      onChange={(e) => setColumnFilterValue(column.id, e.target.value)}
                      placeholder="Filter..."
                      className="h-7 w-32"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setColumnFilterValue(column.id, '')}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
          </div>
        )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead 
                    key={header.id}
                    className={header.column.getCanSort() ? 'cursor-pointer select-none hover:bg-muted/50' : ''}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
                      <TableBody>
                        {table.getRowModel().rows?.length ? (
                          table.getRowModel().rows.map((row) => (
                            <TableRow 
                              key={row.id} 
                              data-state={row.getIsSelected() && 'selected'}
                            >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {table.getState().pagination.pageIndex * pageSize + 1} to{' '}
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * pageSize,
            totalRows
          )}{' '}
          of {totalRows} rows
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

