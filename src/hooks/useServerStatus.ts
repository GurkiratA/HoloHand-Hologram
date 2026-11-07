import { useEffect } from 'react';
import { useHolo } from '@/state/store';

/** Polls /api/health so the UI knows whether a cloud AI provider is configured. */
export function useServerStatus() {
  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        const r = await fetch('/api/health', { signal: AbortSignal.timeout(4000) });
        const j = await r.json();
        if (!stop) useHolo.setState({ server: { reachable: true, provider: j.provider, model: j.model, remoteCatalogs: j.remoteCatalogModels ?? 0 } });
      } catch {
        if (!stop) useHolo.setState({ server: { reachable: false, provider: null, model: null, remoteCatalogs: 0 } });
      }
    };
    void check();
    const t = setInterval(check, 30000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);
}
