import { useEffect } from 'react';
import { holo, useHolo } from '@/state/store';
import { localRecognizer, recognitionTick, resetVotes } from '@/services/recognitionService';

/**
 * Runs on-device recognition every `recognitionInterval` ms while in Live mode.
 * Recognition is decoupled from rendering: it runs on its own timer and a slow
 * pass (or a slow cloud call) never blocks the hologram's frame loop.
 */
export function useRecognition(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const active = useHolo((s) => s.mode === 'live' && s.cameraStatus === 'live' && s.settings.recognitionEnabled);
  const scanToken = useHolo((s) => s.scanToken);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer = 0;
    resetVotes();
    const st = holo();
    if (st.recognitionStatus !== 'confirm' && st.recognitionStatus !== 'detected') {
      useHolo.setState({ recognitionStatus: localRecognizer.ready ? 'scanning' : 'loading', recognitionMessage: localRecognizer.ready ? 'Hold an object up to the camera' : 'Loading on-device recognition models…' });
    }
    localRecognizer
      .init()
      .then(() => {
        if (stopped) return;
        if (holo().recognitionStatus === 'loading') useHolo.setState({ recognitionStatus: 'scanning', recognitionMessage: 'Hold an object up to the camera' });
        const loop = async () => {
          if (stopped) return;
          const s = holo();
          const v = videoRef.current;
          if (v && s.recognitionStatus === 'scanning' && !s.modelLoading && document.visibilityState === 'visible') {
            await recognitionTick(v);
          }
          timer = window.setTimeout(loop, holo().settings.recognitionInterval);
        };
        void loop();
      })
      .catch((e) => {
        console.error(e);
        useHolo.setState({ recognitionStatus: 'error', recognitionMessage: 'On-device recognition failed to load. Use manual search or upload a model.' });
      });
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [active, scanToken, videoRef]);
}
