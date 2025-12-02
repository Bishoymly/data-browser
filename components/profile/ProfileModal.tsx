'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ProfileView } from './ProfileView';
import { ExternalLink } from 'lucide-react';
import { useSchemaStore } from '@/stores/schema-store';
import { useUIStore } from '@/stores/ui-store';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  schema?: string;
  recordId: string | number;
}

export function ProfileModal({ open, onOpenChange, tableName, schema, recordId }: ProfileModalProps) {
  const { aiAnalysis } = useSchemaStore();
  const { showFriendlyNames } = useUIStore();
  
  const tableKey = schema ? `${schema}.${tableName}` : tableName;
  const profileUrl = `/profile/${encodeURIComponent(tableKey)}/${encodeURIComponent(String(recordId))}`;

  // Get friendly table name if enabled
  const getTableDisplayName = (): string => {
    if (showFriendlyNames && aiAnalysis?.friendlyNames) {
      let friendlyName = aiAnalysis.friendlyNames[tableKey];
      if (!friendlyName && schema) {
        friendlyName = aiAnalysis.friendlyNames[tableName];
      }
      if (friendlyName) {
        return friendlyName;
      }
    }
    return schema ? `${schema}.${tableName}` : tableName;
  };

  const displayTableName = getTableDisplayName();
  const modalTitle = `${displayTableName} - ${recordId}`;

  const handleOpenInNewTab = () => {
    window.open(profileUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0" showCloseButton={true}>
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-3">
            <DialogTitle className="m-0">{modalTitle}</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenInNewTab}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Open in New Tab
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <ProfileView tableName={tableName} schema={schema} recordId={recordId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

