'use client';

import { useConnectionStore } from '@/stores/connection-store';
import { useSchemaStore } from '@/stores/schema-store';
import { useRouter, usePathname } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { SchemaCache } from '@/lib/schema/cache';

interface ConnectionSwitcherProps {
  showNewConnection?: boolean;
}

export function ConnectionSwitcher({ showNewConnection = false }: ConnectionSwitcherProps = {}) {
  const { connections, activeConnectionId, setActiveConnection } = useConnectionStore();
  const { setMetadata, setAIAnalysis } = useSchemaStore();
  const router = useRouter();
  const pathname = usePathname();

  const activeConnection = connections.find(c => c.id === activeConnectionId);

  const handleConnectionChange = (connectionId: string) => {
    setActiveConnection(connectionId);
    // Reload schema for the new connection
    const newConnection = connections.find(c => c.id === connectionId);
    if (newConnection) {
      const cachedSchema = SchemaCache.get(newConnection.id);
      if (cachedSchema) {
        setMetadata(cachedSchema);
      }
      if (newConnection.aiAnalysis) {
        setAIAnalysis(newConnection.aiAnalysis);
      }
    }
    // Navigate to dashboard (unless we're already on config page)
    if (pathname !== '/config') {
      router.push('/dashboard');
    }
  };

  const handleAddNewConnection = () => {
    // Navigate to home page which will show the onboarding wizard
    // The wizard will show ConnectionSelector which allows creating a new connection
    router.push('/?new-connection=true');
  };

  return (
    <div className="flex items-center gap-2">
      {connections.length > 0 && (
        <Select value={activeConnectionId || ''} onValueChange={handleConnectionChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select connection">
              {activeConnection?.name || 'Select connection'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {connections.map((conn) => (
              <SelectItem key={conn.id} value={conn.id}>
                {conn.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      
      {showNewConnection && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddNewConnection}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          New Connection
        </Button>
      )}
    </div>
  );
}

