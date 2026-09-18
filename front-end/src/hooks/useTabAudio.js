import { useCallback, useRef, useState } from 'react';

async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function pickMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm';
}

export function useTabAudio() {
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const onChunkRef = useRef(() => {});

  const stop = useCallback(() => {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    } catch {
      /* ignore */
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCapturing(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('This browser cannot capture tab audio.');
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const audioTracks = display.getAudioTracks();
      if (audioTracks.length === 0) {
        display.getTracks().forEach((track) => track.stop());
        setError('Enable Share tab audio / Share system audio in the picker.');
        return;
      }
      const audioStream = new MediaStream(audioTracks);
      const mime = pickMime();
      const recorder = new MediaRecorder(audioStream, { mimeType: mime, audioBitsPerSecond: 64000 });
      recorder.ondataavailable = async (event) => {
        if (!event.data || event.data.size < 1200) return;
        try {
          const base64 = await blobToBase64(event.data);
          onChunkRef.current(base64, event.data.type || mime);
        } catch (err) {
          console.error(err);
        }
      };
      recorder.start(4000);
      recorderRef.current = recorder;
      streamRef.current = display;
      display.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => stop(), { once: true });
      });
      setCapturing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture cancelled.');
      setCapturing(false);
    }
  }, [stop]);

  const setOnChunk = useCallback((fn) => {
    onChunkRef.current = fn;
  }, []);

  const sendFile = useCallback(async (file) => {
    setError(null);
    const base64 = await blobToBase64(file);
    onChunkRef.current(base64, file.type || 'audio/webm');
  }, []);

  return { capturing, error, start, stop, setOnChunk, sendFile };
}
