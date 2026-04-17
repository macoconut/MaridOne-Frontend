const ILLEGAL_FILE_NAME_CHARS = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*']);

function isControlCharacter(value: string) {
  const code = value.charCodeAt(0);
  return Number.isFinite(code) && code >= 0 && code < 32;
}

export function sanitizeFileNamePart(value?: string) {
  if (!value) return '';

  let sanitized = '';
  let previousWasSeparator = false;

  for (const character of value.trim()) {
    const shouldReplace =
      ILLEGAL_FILE_NAME_CHARS.has(character) ||
      isControlCharacter(character) ||
      /\s/.test(character);

    if (shouldReplace) {
      if (!previousWasSeparator) {
        sanitized += '-';
        previousWasSeparator = true;
      }
      continue;
    }

    sanitized += character;
    previousWasSeparator = false;
  }

  return sanitized.replace(/^-|-$/g, '');
}
