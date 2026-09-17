'use client';
import { useEffect, useState, useCallback } from 'react';
import type { Workspace } from '@/domain/schema';
import { api } from './api';
export function useWorkspace() {
  const [data, setData] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    const result = await api<Workspace>('workspace');
    setData(result);
    return result;
  }, []);
  useEffect(() => {
    let mounted = true;
    api<Workspace>('workspace')
      .then((d) => {
        if (mounted) setData(d);
      })
      .catch((e) => {
        if (mounted) setError(e.message);
      });
    return () => {
      mounted = false;
    };
  }, []);
  return { data, error, setError, reload };
}
