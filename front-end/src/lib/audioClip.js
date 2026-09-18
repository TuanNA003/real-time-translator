export function arrayBufferToBase64(buffer) {
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

export async function prepareClip(blob, ctx) {
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

export function pickRecorderMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'audio/webm';
}

export function createAudioContext() {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  return Ctx ? new Ctx() : null;
}
