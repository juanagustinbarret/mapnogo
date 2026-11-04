// src/components/OfflineIndicator.tsx

import React, { useEffect, useState } from 'react';
import { syncService } from '../lib/syncService';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setIsSyncing(true);
      setSyncStatusMsg('Sincronizando cambios guardados...');
      
      const res = await syncService.sync();
      setIsSyncing(false);
      
      if (res.processed > 0) {
        setSyncStatusMsg(`Sincronización completada (${res.processed} elementos).`);
        setTimeout(() => setSyncStatusMsg(null), 4000);
      } else {
        setSyncStatusMsg(null);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatusMsg(null);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !syncStatusMsg) {
    return null; // Oculto cuando todo está en orden
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1rem',
        right: '1rem',
        zIndex: 9999,
        padding: '0.75rem 1.25rem',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        fontWeight: 600,
        fontSize: '0.9rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        transition: 'all 0.3s ease',
        backgroundColor: !isOnline ? '#e53e3e' : isSyncing ? '#dd6b20' : '#38a169',
        color: '#ffffff',
      }}
    >
      <span
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: '#fff',
          display: 'inline-block',
          animation: isSyncing ? 'pulse 1s infinite' : 'none',
        }}
      />
      {!isOnline && 'Sin conexión. Los cambios se guardarán localmente.'}
      {isOnline && syncStatusMsg}
    </div>
  );
};
