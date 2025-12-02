'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { useConnectionStore } from '@/stores/connection-store';
import { useSchemaStore } from '@/stores/schema-store';
import { useRouter, usePathname } from 'next/navigation';
import { SchemaCache } from '@/lib/schema/cache';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { ConfigExport } from '@/components/config/ConfigExport';
import { ConnectionSwitcher } from '@/components/config/ConnectionSwitcher';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { useProfileModalStore } from '@/stores/profile-modal-store';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { connections, activeConnectionId, loadFromStorage, getActiveConnection } =
    useConnectionStore();
  const { setMetadata, setAIAnalysis } = useSchemaStore();
  const { sidebarOpen, setSidebarOpen, showFriendlyNames, setShowFriendlyNames } = useUIStore();
  const { isOpen, tableName, schema, recordId, closeModal } = useProfileModalStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    // Only redirect if we're in the dashboard route group and have no connections
    // Don't redirect if we're on a profile or table page in a new tab
    if (connections.length === 0 && pathname?.startsWith('/dashboard')) {
      router.push('/');
      return;
    }

    const connection = getActiveConnection();
    if (connection) {
      // Load cached schema
      const cachedSchema = SchemaCache.get(connection.id);
      if (cachedSchema) {
        setMetadata(cachedSchema);
      }

      // Load AI analysis from connection config
      if (connection.aiAnalysis) {
        setAIAnalysis(connection.aiAnalysis);
      }
    } else if (activeConnectionId && connections.length > 0) {
      // Connection ID exists but connection not found - might be loading
      // Wait a bit for state to sync
      const timer = setTimeout(() => {
        const conn = getActiveConnection();
        // Only redirect if we're on dashboard route, not profile/table pages
        if (!conn && pathname?.startsWith('/dashboard')) {
          router.push('/');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [connections.length, activeConnectionId, getActiveConnection, router, setMetadata, setAIAnalysis, pathname]);

  if (connections.length === 0) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className={`flex-1 overflow-auto transition-all ${sidebarOpen ? 'md:ml-64' : ''}`}>
        <div className="p-6">
          <div className="mb-4 flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="friendly-names"
                checked={showFriendlyNames}
                onCheckedChange={setShowFriendlyNames}
              />
              <Label htmlFor="friendly-names" className="cursor-pointer">
                Show Friendly Names
              </Label>
            </div>
            <div className="flex items-center gap-2">
              {connections.length > 0 && <ConnectionSwitcher />}
              <ConfigExport />
            </div>
          </div>
          {children}
        </div>
      </main>
      {isOpen && tableName && recordId !== null && recordId !== undefined && (
        <ProfileModal
          open={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeModal();
            }
          }}
          tableName={tableName}
          schema={schema}
          recordId={recordId}
        />
      )}
    </div>
  );
}

