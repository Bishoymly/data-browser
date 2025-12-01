'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { DatabaseType } from '@/types/database';
import { Column as SchemaColumn } from '@/types/schema';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DataGridProps {
  tableName: string;
  schema?: string;
}

export function DataGrid({ tableName, schema }: DataGridProps) {
  const { getActiveConnection } = useConnectionStore();
  const { metadata, aiAnalysis } = useSchemaStore();
  const { showFriendlyNames } = useUIStore();
  const router = useRouter();

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

  const handleRowClick = (row: any) => {
    const recordId = getRecordId(row);
    if (!recordId) return;
    
    const tableKey = schema ? `${schema}.${tableName}` : tableName;
    const profileUrl = `/profile/${encodeURIComponent(tableKey)}/${recordId}`;
    router.push(profileUrl);
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
    
    return sortedColumns.map((col) => {
      const columnKey = schema ? `${schema}.${tableName}.${col.name}` : `${tableName}.${col.name}`;
      
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
        header: friendlyName,
        cell: ({ getValue }) => {
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
            if (lookupMap && lookupMap.has(value)) {
              const displayValue = lookupMap.get(value);
              return (
                <span title={`${col.name}: ${value}`}>
                  {displayValue}
                </span>
              );
            }
            // Fallback: show ID if lookup not loaded yet
            return (
              <span className="text-muted-foreground" title={`Lookup: ${config.lookupTable} (ID: ${value})`}>
                {String(value)}
              </span>
            );
          }
          
          // Apply display format
          return formatValue(value, config?.displayFormat);
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ColumnSelector
              columns={columns}
              table={table}
              tableName={tableName}
              schema={schema}
            />
          </div>
        </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(row.original)}
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

