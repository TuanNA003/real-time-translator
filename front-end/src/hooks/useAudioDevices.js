import { useCallback, useEffect, useState } from 'react';

export const BROWSER_MIC_ID = 'default';
export const DEFAULT_OUTPUT_ID = 'default';

const INPUT_KEY = 'loi-audio-input-v1';
const OUTPUT_KEY = 'loi-audio-output-v1';

function readSaved(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === 'browser') return fallback;
    return raw ?? fallback;
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

function isHiddenDevice(device) {
  return !device.deviceId || device.deviceId === 'default' || device.deviceId === 'communications';
}

function stripDefaultPrefix(label) {
  return label.replace(/^Default\s*[-–:]\s*/i, '').trim();
}

function currentDeviceName(list, kind) {
  const ofKind = list.filter((device) => device.kind === kind);
  const listed =
    ofKind.find((device) => device.deviceId === 'default') ??
    ofKind.find((device) => /^Default\s*[-–:]/i.test(device.label));
  if (listed?.label.trim()) {
    const name = stripDefaultPrefix(listed.label);
    if (name) return name;
  }
  const twin = ofKind.find(
    (device) => !isHiddenDevice(device) && device.groupId && device.groupId === listed?.groupId,
  );
  if (twin?.label.trim()) return twin.label.trim();
  const first = ofKind.find((device) => !isHiddenDevice(device) && device.label.trim());
  return first?.label.trim() || null;
}

function physicalOptions(list, kind) {
  return list
    .filter((device) => device.kind === kind && !isHiddenDevice(device))
    .map((device, index) => ({
      id: device.deviceId,
      label:
        device.label.trim() ||
        (kind === 'audioinput' ? `Microphone ${index + 1}` : `Speakers ${index + 1}`),
    }));
}

function defaultOption(name) {
  return { id: 'default', label: `Default (${name ?? 'current device'})` };
}

export function useAudioDevices() {
  const [inputs, setInputs] = useState([defaultOption(null)]);
  const [outputs, setOutputs] = useState([defaultOption(null)]);
  const [inputId, setInputIdState] = useState(BROWSER_MIC_ID);
  const [outputId, setOutputIdState] = useState(DEFAULT_OUTPUT_ID);
  const [permission, setPermission] = useState('unknown');

  const refresh = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    setInputs([defaultOption(currentDeviceName(list, 'audioinput')), ...physicalOptions(list, 'audioinput')]);
    setOutputs([defaultOption(currentDeviceName(list, 'audiooutput')), ...physicalOptions(list, 'audiooutput')]);
  }, []);

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
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    setInputIdState(readSaved(INPUT_KEY, BROWSER_MIC_ID));
    setOutputIdState(readSaved(OUTPUT_KEY, DEFAULT_OUTPUT_ID));
    void (async () => {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' });
        if (status.state === 'granted') {
          await ensurePermission();
          return;
        }
      } catch {
        /* Safari / Firefox */
      }
      await refresh();
    })();
    if (!navigator.mediaDevices?.addEventListener) return undefined;
    const onChange = () => void refresh();
    navigator.mediaDevices.addEventListener('devicechange', onChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', onChange);
  }, [ensurePermission, refresh]);

  const setInputId = useCallback((id) => {
    const next = id === 'browser' ? BROWSER_MIC_ID : id;
    setInputIdState(next);
    writeSaved(INPUT_KEY, next);
  }, []);

  const setOutputId = useCallback((id) => {
    setOutputIdState(id);
    writeSaved(OUTPUT_KEY, id);
  }, []);

  const inputLabel = inputs.find((device) => device.id === inputId)?.label ?? defaultOption(null).label;
  const usingBrowserMic = inputId === BROWSER_MIC_ID || inputId === 'browser';

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
    usingBrowserMic,
  };
}
