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

interface DataGridProps {
  tableName: string;
  schema?: string;
}

export function DataGrid({ tableName, schema }: DataGridProps) {
  const { getActiveConnection } = useConnectionStore();
  const { metadata, aiAnalysis } = useSchemaStore();
  const { showFriendlyNames } = useUIStore();

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

  const connection = getActiveConnection();

  // Get table columns
  useEffect(() => {
    if (!metadata) return;
    const table = metadata.tables.find(
      (t) =>
        t.name === tableName &&
        (schema ? t.schema === schema : !t.schema)
    );
    if (table) {
      setColumns(table.columns);
    }
  }, [metadata, tableName, schema]);

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

  // Build table columns
  const tableColumns = useMemo<ColumnDef<any>[]>(() => {
    return columns.map((col) => {
      const columnKey = schema ? `${schema}.${tableName}.${col.name}` : `${tableName}.${col.name}`;
      const friendlyName =
        showFriendlyNames && aiAnalysis?.friendlyNames[columnKey]
          ? aiAnalysis.friendlyNames[columnKey]
          : col.name;

      return {
        accessorKey: col.name,
        header: friendlyName,
        cell: ({ getValue }) => {
          const value = getValue();
          // Handle lookup values if configured
          const config = aiAnalysis?.columnConfigs[columnKey];
          if (config?.lookupTable && value) {
            // In a real implementation, you'd fetch the lookup value
            // For now, just show the value
            return String(value);
          }
          return value === null || value === undefined ? (
            <span className="text-muted-foreground">null</span>
          ) : (
            String(value)
          );
        },
        enableSorting: true,
        enableHiding: true,
      };
    });
  }, [columns, showFriendlyNames, aiAnalysis, schema, tableName]);

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
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
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

