type NormalizedMessage = {
  text: string;
  preview: string;
  type: string;
};

const templateTextMap: Record<string, string> = {
  plantilla_reactivacion: 'Plantilla de reactivación enviada. Respondé este mensaje para continuar con el trámite.',
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

const getRecord = (value: unknown): Record<string, unknown> | null => {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
};

const getStringProp = (obj: Record<string, unknown> | null, key: string): string => {
  if (!obj) return '';
  const value = obj[key];
  return typeof value === 'string' ? value : '';
};

export const normalizeMessageContent = (input: unknown): NormalizedMessage => {
  const raw = input ?? '';
  const asString = typeof raw === 'string' ? raw : '';
  const trimmed = asString.trim();
  const parsed =
    trimmed &&
    ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']')))
      ? safeJsonParse(trimmed)
      : null;

  const obj = getRecord(parsed) ?? getRecord(raw);

  if (typeof raw === 'string') {
    const templateMatch = raw.match(/Template:\s*([^()]+)\s*(?:\(([^)]+)\))?/i);
    if (templateMatch) {
      const templateName = templateMatch[1]?.trim();
      const displayText = getTemplateDisplayText(templateName);
      return { text: displayText, preview: displayText, type: 'text' };
    }
  }

  if (obj) {
    const templateName =
      getStringProp(obj, 'templateName') || getStringProp(obj, 'template') || getStringProp(obj, 'name');
    if (templateName) {
      const displayText = getTemplateDisplayText(String(templateName));
      return { text: displayText, preview: displayText, type: 'text' };
    }
  }

  const isInteractiveList =
    !!obj &&
    (getStringProp(obj, 'type') === 'interactive_list' ||
      getStringProp(obj, 'type') === 'interactive_buttons' ||
      getStringProp(obj, 'type') === 'interactive' ||
      !!obj.sections ||
      !!obj.buttonText ||
      !!obj.buttons);

  if (isInteractiveList) {
    const header = getStringProp(obj, 'header') || 'Menú interactivo';
    const body = getStringProp(obj, 'body');
    const buttonText = getStringProp(obj, 'buttonText');
    const preview = [header, body || buttonText].filter(Boolean).join(' - ').trim();
    return {
      text: typeof raw === 'string' ? raw : JSON.stringify(obj),
      preview,
      type: 'interactive'
    };
  }

  let fallbackText = typeof raw === 'string' ? raw : raw ? JSON.stringify(raw) : '';
  if (obj) {
    fallbackText =
      getStringProp(obj, 'cuerpo') ||
      getStringProp(obj, 'contenido') ||
      getStringProp(obj, 'text') ||
      getStringProp(obj, 'body') ||
      fallbackText;
  }

  return {
    text: fallbackText,
    preview: fallbackText,
    type: 'text'
  };
};
