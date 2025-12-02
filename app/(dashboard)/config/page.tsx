'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfigExport } from '@/components/config/ConfigExport';
import { ConnectionSwitcher } from '@/components/config/ConnectionSwitcher';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ConfigStorage } from '@/lib/config/storage';
import { SchemaCache } from '@/lib/schema/cache';
import { useConnectionStore } from '@/stores/connection-store';
import { useSchemaStore } from '@/stores/schema-store';

export default function ConfigPage() {
  const router = useRouter();
  const { clear } = useSchemaStore();
  const { setConnections, setActiveConnection } = useConnectionStore();

  const handleResetConfiguration = () => {
    // Clear all storage
    ConfigStorage.clear();
    
    // Clear schema cache
    SchemaCache.clearAll();
    
    // Clear stores
    clear();
    
    // Reset connection store
    setConnections([]);
    setActiveConnection(undefined);
    
    // Navigate to home page to start fresh
    router.push('/');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuration</h1>
        <p className="text-muted-foreground">Manage your database connections and settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connections</CardTitle>
          <CardDescription>Switch between database connections or add a new one</CardDescription>
        </CardHeader>
        <CardContent>
          <ConnectionSwitcher showNewConnection={true} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export & Import</CardTitle>
          <CardDescription>Download, upload, or save your configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <ConfigExport />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset Configuration</CardTitle>
          <CardDescription>
            Clear all saved connections, schemas, and configurations. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Reset All Configuration
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset Configuration</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear all saved connections, schemas, and configurations. 
                  You will be redirected to the setup wizard. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetConfiguration} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Reset All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

