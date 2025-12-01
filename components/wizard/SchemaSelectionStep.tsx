'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { SchemaConfig } from '@/types/config';
import { Table } from '@/types/schema';

interface SchemaSelectionStepProps {
  schemas: string[];
  tables: Table[];
  onNext: (config: SchemaConfig) => void;
  initialConfig?: SchemaConfig;
}

export function SchemaSelectionStep({
  schemas,
  tables,
  onNext,
  initialConfig,
}: SchemaSelectionStepProps) {
  const [selectionMode, setSelectionMode] = useState<'all' | 'schemas' | 'tables'>(
    initialConfig?.showAll ? 'all' : initialConfig?.selectedSchemas ? 'schemas' : 'tables'
  );
  const [selectedSchemas, setSelectedSchemas] = useState<string[]>(
    initialConfig?.selectedSchemas || []
  );
  const [selectedTables, setSelectedTables] = useState<string[]>(
    initialConfig?.selectedTables || []
  );
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTables = tables.filter((table) => {
    const fullName = table.schema ? `${table.schema}.${table.name}` : table.name;
    return fullName.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const toggleSchema = (schema: string) => {
    setSelectedSchemas((prev) =>
      prev.includes(schema) ? prev.filter((s) => s !== schema) : [...prev, schema]
    );
  };

  const toggleTable = (table: Table) => {
    const key = table.schema ? `${table.schema}.${table.name}` : table.name;
    setSelectedTables((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  const handleNext = () => {
    const config: SchemaConfig = {
      showAll: selectionMode === 'all',
      selectedSchemas: selectionMode === 'schemas' ? selectedSchemas : undefined,
      selectedTables: selectionMode === 'tables' ? selectedTables : undefined,
    };
    onNext(config);
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Schema Selection</CardTitle>
        <CardDescription>
          Choose which tables to include in your database browser.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>Selection Mode</Label>
          <div className="flex gap-4">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                checked={selectionMode === 'all'}
                onChange={() => setSelectionMode('all')}
                className="h-4 w-4"
              />
              <span>Show All Tables</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                checked={selectionMode === 'schemas'}
                onChange={() => setSelectionMode('schemas')}
                className="h-4 w-4"
              />
              <span>Select Schemas</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                checked={selectionMode === 'tables'}
                onChange={() => setSelectionMode('tables')}
                className="h-4 w-4"
              />
              <span>Select Tables</span>
            </label>
          </div>
        </div>

        {selectionMode === 'schemas' && (
          <div className="space-y-2">
            <Label>Select Schemas</Label>
            <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
              {schemas.map((schema) => (
                <label key={schema} className="flex items-center space-x-2 py-2">
                  <Checkbox
                    checked={selectedSchemas.includes(schema)}
                    onCheckedChange={() => toggleSchema(schema)}
                  />
                  <span>{schema}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {selectionMode === 'tables' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Tables</Label>
              <Input
                placeholder="Search tables..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            <div className="border rounded-md p-4 max-h-96 overflow-y-auto">
              {filteredTables.map((table) => {
                const key = table.schema ? `${table.schema}.${table.name}` : table.name;
                return (
                  <label key={key} className="flex items-center space-x-2 py-2">
                    <Checkbox
                      checked={selectedTables.includes(key)}
                      onCheckedChange={() => toggleTable(table)}
                    />
                    <span>
                      {table.schema ? `${table.schema}.` : ''}
                      {table.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleNext}>Next</Button>
        </div>
      </CardContent>
    </Card>
  );
}

