import { useCallback, useEffect, useState } from 'react';

export const BROWSER_MIC_ID = 'browser';
export const DEFAULT_OUTPUT_ID = 'default';

const INPUT_KEY = 'loi-audio-input-v1';
const OUTPUT_KEY = 'loi-audio-output-v1';

function readSaved(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeSaved(key, value) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function friendlyLabel(device, index) {
  const label = device.label.trim();
  if (label) return label.replace(/^Default\s*-\s*/i, '');
  return device.kind === 'audioinput' ? `Microphone ${index + 1}` : `Speakers ${index + 1}`;
}

export function useAudioDevices() {
  const [inputs, setInputs] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [inputId, setInputIdState] = useState(BROWSER_MIC_ID);
  const [outputId, setOutputIdState] = useState(DEFAULT_OUTPUT_ID);
  const [permission, setPermission] = useState('unknown');

  const refresh = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    const rawInputs = list.filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'communications');
    const rawOutputs = list.filter((d) => d.kind === 'audiooutput' && d.deviceId && d.deviceId !== 'communications');
    setInputs(rawInputs.map((d, i) => ({ id: d.deviceId, label: friendlyLabel(d, i) })));
    const nextOutputs = [{ id: DEFAULT_OUTPUT_ID, label: 'System default' }];
    rawOutputs.forEach((d, i) => {
      if (d.deviceId === DEFAULT_OUTPUT_ID) return;
      nextOutputs.push({ id: d.deviceId, label: friendlyLabel(d, i) });
    });
    setOutputs(nextOutputs);
  }, []);

  useEffect(() => {
    setInputIdState(readSaved(INPUT_KEY, BROWSER_MIC_ID));
    setOutputIdState(readSaved(OUTPUT_KEY, DEFAULT_OUTPUT_ID));
    void refresh();
    if (!navigator.mediaDevices?.addEventListener) return undefined;
    const onChange = () => void refresh();
    navigator.mediaDevices.addEventListener('devicechange', onChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange);
  }, [refresh]);

  const ensurePermission = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission('denied');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setPermission('granted');
      await refresh();
    } catch {
      setPermission('denied');
    }
  }, [refresh]);

  const setInputId = useCallback((id) => {
    setInputIdState(id);
    writeSaved(INPUT_KEY, id);
  }, []);

  const setOutputId = useCallback((id) => {
    setOutputIdState(id);
    writeSaved(OUTPUT_KEY, id);
  }, []);

  const inputLabel =
    inputId === BROWSER_MIC_ID
      ? 'Browser microphone'
      : (inputs.find((d) => d.id === inputId)?.label ?? 'Microphone');

  return {
    inputs,
    outputs,
    inputId,
    outputId,
    inputLabel,
    permission,
    setInputId,
    setOutputId,
    ensurePermission,
    usingBrowserMic: inputId === BROWSER_MIC_ID,
  };
}
