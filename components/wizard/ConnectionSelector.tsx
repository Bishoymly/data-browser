'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConnectionConfig } from '@/types/config';
import { Database } from 'lucide-react';

interface ConnectionSelectorProps {
  connections: ConnectionConfig[];
  onSelect: (connection: ConnectionConfig) => void;
  onNew: () => void;
}

export function ConnectionSelector({ connections, onSelect, onNew }: ConnectionSelectorProps) {
  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Select Connection</CardTitle>
        <CardDescription>
          Choose an existing connection or create a new one.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {connections.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Existing Connections</h3>
            <div className="space-y-2">
              {connections.map((conn) => (
                <button
                  key={conn.id}
                  onClick={() => onSelect(conn)}
                  className="w-full text-left p-4 border rounded-md hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{conn.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {conn.type} - {conn.config.database} @ {conn.config.server}
                      </div>
                    </div>
                    <Database className="h-5 w-5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="pt-4 border-t">
          <Button onClick={onNew} className="w-full">
            Create New Connection
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

