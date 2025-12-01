'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSchemaStore } from '@/stores/schema-store';
import { useConnectionStore } from '@/stores/connection-store';
import { useUIStore } from '@/stores/ui-store';
import { Table } from '@/types/schema';
import { Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const { metadata, aiAnalysis } = useSchemaStore();
  const { getActiveConnection } = useConnectionStore();
  const { showFriendlyNames, sidebarOpen, setSidebarOpen } = useUIStore();
  const [searchTerm, setSearchTerm] = useState('');
  const pathname = usePathname();

  const connection = getActiveConnection();
  const schemaConfig = connection?.schemaConfig;

  const filteredTables = useMemo(() => {
    if (!metadata) return [];

    let tables = metadata.tables;

    // Apply schema selection
    if (schemaConfig) {
      if (!schemaConfig.showAll) {
        if (schemaConfig.selectedSchemas) {
          tables = tables.filter(
            (table) => table.schema && schemaConfig.selectedSchemas!.includes(table.schema)
          );
        } else if (schemaConfig.selectedTables) {
          tables = tables.filter((table) => {
            const key = table.schema ? `${table.schema}.${table.name}` : table.name;
            return schemaConfig.selectedTables!.includes(key);
          });
        }
      }
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      tables = tables.filter((table) => {
        const tableKey = table.schema ? `${table.schema}.${table.name}` : table.name;
        const friendlyName = aiAnalysis?.friendlyNames[tableKey];
        return (
          tableKey.toLowerCase().includes(term) ||
          (friendlyName && friendlyName.toLowerCase().includes(term))
        );
      });
    }

    return tables;
  }, [metadata, schemaConfig, searchTerm, aiAnalysis]);

  const getTableDisplayName = (table: Table): string => {
    const key = table.schema ? `${table.schema}.${table.name}` : table.name;
    if (showFriendlyNames && aiAnalysis?.friendlyNames[key]) {
      return aiAnalysis.friendlyNames[key];
    }
    return table.schema ? `${table.schema}.${table.name}` : table.name;
  };

  const getTableUrl = (table: Table): string => {
    const key = table.schema ? `${table.schema}.${table.name}` : table.name;
    return `/table/${encodeURIComponent(key)}`;
  };

  if (!metadata) {
    return null;
  }

  return (
    <>
      {sidebarOpen && (
        <div className="fixed inset-y-0 left-0 z-50 w-64 bg-background border-r">
          <div className="flex flex-col h-full">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Tables</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(false)}
                  className="md:hidden"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tables..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredTables.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  No tables found
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredTables.map((table) => {
                    const url = getTableUrl(table);
                    const isActive = pathname === url;
                    return (
                      <Link key={table.schema ? `${table.schema}.${table.name}` : table.name} href={url}>
                        <div
                          className={`px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-accent'
                          }`}
                        >
                          {getTableDisplayName(table)}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {!sidebarOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(true)}
          className="fixed left-2 top-2 z-40 md:hidden"
        >
          <Search className="h-4 w-4" />
        </Button>
      )}
    </>
  );
}

