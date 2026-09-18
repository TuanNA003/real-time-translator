export const LANGUAGES = [
  { id: 'vi', label: 'Vietnamese', native: 'Tiếng Việt', speech: 'vi-VN', translate: 'vi' },
  { id: 'en', label: 'English', native: 'English', speech: 'en-US', translate: 'en' },
  { id: 'ja', label: 'Japanese', native: '日本語', speech: 'ja-JP', translate: 'ja' },
  { id: 'ko', label: 'Korean', native: '한국어', speech: 'ko-KR', translate: 'ko' },
  { id: 'zh', label: 'Chinese', native: '中文', speech: 'zh-CN', translate: 'zh-CN' },
  { id: 'th', label: 'Thai', native: 'ไทย', speech: 'th-TH', translate: 'th' },
  { id: 'id', label: 'Indonesian', native: 'Bahasa Indonesia', speech: 'id-ID', translate: 'id' },
  { id: 'fr', label: 'French', native: 'Français', speech: 'fr-FR', translate: 'fr' },
  { id: 'de', label: 'German', native: 'Deutsch', speech: 'de-DE', translate: 'de' },
  { id: 'es', label: 'Spanish', native: 'Español', speech: 'es-ES', translate: 'es' },
];

export function languageById(id) {
  return LANGUAGES.find((lang) => lang.id === id) ?? LANGUAGES[0];
}
