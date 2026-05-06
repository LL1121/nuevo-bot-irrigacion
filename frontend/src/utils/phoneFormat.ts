export const normalizePhoneKey = (value?: string) => (value || '').replace(/\D/g, '');

export const formatPhoneForDisplay = (value?: string) => {
  const digits = normalizePhoneKey(value);
  if (!digits) return 'Sin teléfono';

  if (digits.startsWith('549') && digits.length >= 13) {
    const cc = digits.slice(0, 2);
    const area = digits.slice(3, 6);
    const part1 = digits.slice(6, 10);
    const part2 = digits.slice(10, 13);
    return `+${cc} 9 ${area} ${part1}-${part2}`;
  }

  if (digits.startsWith('54') && digits.length >= 12) {
    const cc = digits.slice(0, 2);
    const area = digits.slice(2, 5);
    const part1 = digits.slice(5, 9);
    const part2 = digits.slice(9, 12);
    return `+${cc} ${area} ${part1}-${part2}`;
  }

  return `+${digits}`;
};

export const phonesMatch = (a?: string, b?: string) => {
  const na = normalizePhoneKey(a);
  const nb = normalizePhoneKey(b);
  return !!na && !!nb && na === nb;
};
