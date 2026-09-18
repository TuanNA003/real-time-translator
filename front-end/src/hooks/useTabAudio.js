import { useCallback, useRef, useState } from 'react';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function blobToBase64(blob) {
  return arrayBufferToBase64(await blob.arrayBuffer());
}

function writeString(view, offset, value) {
  for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
}

function encodeWav(buffer) {
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;
  const bytes = new ArrayBuffer(44 + length * 2);
  const view = new DataView(bytes);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, length * 2, true);
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const mixed = right ? (left[i] + right[i]) / 2 : left[i];
    const clamped = Math.max(-1, Math.min(1, mixed));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return bytes;
}

async function prepareClip(blob, ctx) {
  if (ctx) {
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      return { base64: arrayBufferToBase64(encodeWav(decoded)), mime: 'audio/wav' };
    } catch {
      /* fall through */
    }
  }
  return { base64: await blobToBase64(blob), mime: blob.type || 'audio/webm' };
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
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
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
      setError('Tab audio ended.');
      return;
    }
    const mime = mimeRef.current;
    const recorder = new MediaRecorder(new MediaStream(audioTracks), {
      mimeType: mime,
      audioBitsPerSecond: 64000,
    });
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
    }, 4000);
  }, [stop]);

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
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = Ctx ? new Ctx() : null;
      mimeRef.current = pickMime();
      streamRef.current = display;
      capturingRef.current = true;
      display.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => stop(), { once: true });
      });
      setCapturing(true);
      spawnRecorder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Capture cancelled.');
      capturingRef.current = false;
      setCapturing(false);
    }
  }, [spawnRecorder, stop]);

  const setOnChunk = useCallback((fn) => {
    onChunkRef.current = fn;
  }, []);

  const sendFile = useCallback(async (file) => {
    setError(null);
    let ctx = ctxRef.current;
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctx = Ctx ? new Ctx() : null;
    }
    const prepared = await prepareClip(file, ctx);
    onChunkRef.current(prepared.base64, prepared.mime);
  }, []);

  return { capturing, error, start, stop, setOnChunk, sendFile };
}
