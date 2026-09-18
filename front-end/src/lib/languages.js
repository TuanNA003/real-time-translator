export const LANGUAGES = [
  { id: 'vi', label: 'Vietnamese', native: 'Tiếng Việt', speech: 'vi-VN', translate: 'vi' },
  { id: 'en', label: 'English', native: 'English', speech: 'en-US', translate: 'en' },
  { id: 'ja', label: 'Japanese', native: 'Japanese', speech: 'ja-JP', translate: 'ja' },
  { id: 'ko', label: 'Korean', native: 'Korean', speech: 'ko-KR', translate: 'ko' },
  { id: 'zh', label: 'Chinese', native: 'Chinese', speech: 'zh-CN', translate: 'zh-CN' },
  { id: 'th', label: 'Thai', native: 'Thai', speech: 'th-TH', translate: 'th' },
  { id: 'id', label: 'Indonesian', native: 'Bahasa Indonesia', speech: 'id-ID', translate: 'id' },
  { id: 'fr', label: 'French', native: 'French', speech: 'fr-FR', translate: 'fr' },
  { id: 'de', label: 'German', native: 'German', speech: 'de-DE', translate: 'de' },
  { id: 'es', label: 'Spanish', native: 'Spanish', speech: 'es-ES', translate: 'es' },
];

export function languageById(id) {
  return LANGUAGES.find((lang) => lang.id === id) ?? LANGUAGES[0];
}
