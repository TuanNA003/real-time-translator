import { useCallback, useRef, useState } from 'react';
import { createAudioContext, pickRecorderMime, prepareClip } from '../lib/audioClip';

const CHUNK_MS = 3000;

export function useMicAudio() {
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const capturingRef = useRef(false);
  const mimeRef = useRef('audio/webm');
  const ctxRef = useRef(null);
  const onChunkRef = useRef(() => {});

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = useCallback(() => {
    capturingRef.current = false;
    clearTimer();
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    } catch {
      /* ignore */
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void ctxRef.current?.close();
    ctxRef.current = null;
    setCapturing(false);
  }, []);

  const spawnRecorder = useCallback(() => {
    const stream = streamRef.current;
    if (!capturingRef.current || !stream) return;
    const audioTracks = stream.getAudioTracks().filter((track) => track.readyState === 'live');
    if (audioTracks.length === 0) {
      stop();
      setError('Microphone ended.');
      return;
    }
    const mime = mimeRef.current;
    const recorder = new MediaRecorder(new MediaStream(audioTracks), { mimeType: mime, audioBitsPerSecond: 64000 });
    recorder.ondataavailable = async (event) => {
      if (!event.data || event.data.size < 1200) return;
      try {
        const prepared = await prepareClip(event.data, ctxRef.current);
        onChunkRef.current(prepared.base64, prepared.mime);
      } catch (err) {
        console.error(err);
      }
    };
    recorder.onstop = () => {
      if (capturingRef.current) spawnRecorder();
    };
    recorder.start();
    recorderRef.current = recorder;
    timerRef.current = window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, CHUNK_MS);
  }, [stop]);

  const start = useCallback(
    async (deviceId) => {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot use a chosen microphone.');
        return false;
      }
      stop();
      try {
        const audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
        if (deviceId) audio.deviceId = { exact: deviceId };
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        ctxRef.current = createAudioContext();
        mimeRef.current = pickRecorderMime();
        streamRef.current = stream;
        capturingRef.current = true;
        stream.getAudioTracks().forEach((track) => {
          track.addEventListener('ended', () => stop(), { once: true });
        });
        setCapturing(true);
        spawnRecorder();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Microphone permission denied.');
        capturingRef.current = false;
        setCapturing(false);
        return false;
      }
    },
    [spawnRecorder, stop],
  );

  const setOnChunk = useCallback((fn) => {
    onChunkRef.current = fn;
  }, []);

  return { capturing, error, start, stop, setOnChunk };
}
