type NormalizedMessage = {
  text: string;
  preview: string;
  type: string;
};

const templateTextMap: Record<string, string> = {
  reactivacion_tramite: 'Plantilla de reactivación enviada. Respondé este mensaje para continuar con el trámite.',
  reactivaciontramite: 'Plantilla de reactivación enviada. Respondé este mensaje para continuar con el trámite.'
};

const safeJsonParse = (value: string) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const getTemplateDisplayText = (templateName?: string) => {
  if (!templateName) return '';
  const key = templateName.replace(/\b(es[-_]?ar|esAr|esAR)\b/i, '').trim();
  return templateTextMap[key] || `Plantilla: ${templateName}`;
};

export const normalizeMessageContent = (input: any): NormalizedMessage => {
  const raw = input ?? '';
  const asString = typeof raw === 'string' ? raw : '';
  const trimmed = asString.trim();
  const parsed =
    trimmed &&
    ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')))
      ? safeJsonParse(trimmed)
      : null;

  const obj =
    parsed && typeof parsed === 'object'
      ? parsed
      : typeof raw === 'object' && raw !== null
        ? raw
        : null;

  if (typeof raw === 'string') {
    const templateMatch = raw.match(/Template:\s*([^()]+)\s*(?:\(([^)]+)\))?/i);
    if (templateMatch) {
      const templateName = templateMatch[1]?.trim();
      const displayText = getTemplateDisplayText(templateName);
      return { text: displayText, preview: displayText, type: 'text' };
    }
  }

  if (obj && typeof obj === 'object') {
    const templateName = (obj as any).templateName || (obj as any).template || (obj as any).name;
    if (templateName) {
      const displayText = getTemplateDisplayText(String(templateName));
      return { text: displayText, preview: displayText, type: 'text' };
    }
  }

  const isInteractiveList =
    !!obj &&
    typeof obj === 'object' &&
    ((obj as any).type === 'interactive_list' ||
      (obj as any).type === 'interactive' ||
      (obj as any).sections ||
      (obj as any).buttonText);

  if (isInteractiveList) {
    const header = (obj as any).header || 'Menú interactivo';
    const body = (obj as any).body || '';
    const buttonText = (obj as any).buttonText || '';
    const preview = [header, body || buttonText].filter(Boolean).join(' - ').trim();
    return {
      text: typeof raw === 'string' ? raw : JSON.stringify(obj),
      preview,
      type: 'interactive'
    };
  }

  let fallbackText = typeof raw === 'string' ? raw : raw ? JSON.stringify(raw) : '';
  if (obj && typeof obj === 'object') {
    fallbackText =
      (obj as any).cuerpo ||
      (obj as any).contenido ||
      (obj as any).text ||
      (obj as any).body ||
      fallbackText;
  }

  return {
    text: fallbackText,
    preview: fallbackText,
    type: 'text'
  };
};
