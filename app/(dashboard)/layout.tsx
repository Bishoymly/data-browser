'use client';

import { useEffect } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { useConnectionStore } from '@/stores/connection-store';
import { useSchemaStore } from '@/stores/schema-store';
import { useRouter } from 'next/navigation';
import { SchemaCache } from '@/lib/schema/cache';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { ConfigExport } from '@/components/config/ConfigExport';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { connections, activeConnectionId, loadFromStorage, getActiveConnection } =
    useConnectionStore();
  const { setMetadata, setAIAnalysis } = useSchemaStore();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const router = useRouter();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (connections.length === 0) {
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
        if (!conn) {
          router.push('/');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [connections.length, activeConnectionId, getActiveConnection, router, setMetadata, setAIAnalysis]);

  if (connections.length === 0) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className={`flex-1 overflow-auto transition-all ${sidebarOpen ? 'md:ml-64' : ''}`}>
        <div className="p-6">
          <div className="mb-4 flex justify-end">
            <ConfigExport />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

