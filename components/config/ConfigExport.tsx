'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfigExporter } from '@/lib/config/export';
import { useConnectionStore } from '@/stores/connection-store';
import { Download, Upload, Server, Database, Settings } from 'lucide-react';
import { useState } from 'react';
import { ConfigImporter } from '@/lib/config/import';
import { useRouter } from 'next/navigation';

export function ConfigExport() {
  const { connections, activeConnectionId, setConnections, setActiveConnection } =
    useConnectionStore();
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleExport = () => {
    const config = {
      connections,
      activeConnectionId,
    };
    ConfigExporter.download(config);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          setLoading(true);
          const imported = await ConfigImporter.fromFile(file);
          setConnections(imported.connections);
          if (imported.activeConnectionId) {
            setActiveConnection(imported.activeConnectionId);
          }
        } catch (error: any) {
          alert(`Failed to import: ${error.message}`);
        } finally {
          setLoading(false);
        }
      }
    };
    input.click();
  };

  const handleSaveToServer = async () => {
    try {
      setLoading(true);
      const config = {
        connections,
        activeConnectionId,
      };
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save-server',
          config,
          filename: `config-${Date.now()}.json`,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save to server');
      }

      alert('Configuration saved to server successfully');
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDatabase = async () => {
    const connection = connections.find((c) => c.id === activeConnectionId);
    if (!connection) {
      alert('No active connection');
      return;
    }

    try {
      setLoading(true);
      const config = {
        connections,
        activeConnectionId,
      };
      const response = await fetch('/api/config/save-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: connection.type,
          config: connection.config,
          appConfig: config,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save to database');
      }

      alert('Configuration saved to database successfully');
    } catch (error: any) {
      alert(`Failed to save: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleManageConfig = () => {
    router.push('/config');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          <Settings className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleManageConfig}>
          <Settings className="mr-2 h-4 w-4" />
          Manage Config
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Download Config
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleImport}>
          <Upload className="mr-2 h-4 w-4" />
          Import Config
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSaveToServer}>
          <Server className="mr-2 h-4 w-4" />
          Save to Server
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSaveToDatabase}>
          <Database className="mr-2 h-4 w-4" />
          Save to Database
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

