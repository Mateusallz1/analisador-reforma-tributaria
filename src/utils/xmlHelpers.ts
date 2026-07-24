export function formatEmissionDate(xmlDate: string | null): string {
  if (!xmlDate) return 'Não informada';
  try {
    const datePart = xmlDate.split('T')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return xmlDate;
  } catch {
    return xmlDate;
  }
}

export function parseXmlDate(xmlDate: string | null): Date | null {
  if (!xmlDate) return null;
  try {
    const match = xmlDate.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const [_, year, month, day] = match;
    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);
    const parsedDay = parseInt(day, 10);
    const date = new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay));

    return date.getUTCFullYear() === parsedYear &&
      date.getUTCMonth() === parsedMonth - 1 &&
      date.getUTCDate() === parsedDay
      ? date
      : null;
  } catch {
    return null;
  }
}

export function getElementsByLocalName(parent: Element | Document | null, tagName: string): Element[] {
  if (!parent) return [];

  const expectedName = tagName.toLowerCase();
  return Array.from(parent.getElementsByTagName('*')).filter((element) => {
    const localName = element.localName || element.tagName.split(':').pop() || element.tagName;
    return localName.toLowerCase() === expectedName;
  });
}

export function getTagValue(parent: Element | Document | null, tagName: string): string | null {
  const element = getElementsByLocalName(parent, tagName)[0];
  return element?.textContent?.trim() || null;
}

export function extractPRedAliq(itemElement: Element, groupName: string): number {
  if (!itemElement) return 0.0;

  let group: Element | null = null;
  group = getElementsByLocalName(itemElement, groupName)[0] || null;

  if (!group) return 0.0;

  let gRed: Element | null = null;
  gRed = getElementsByLocalName(group, 'gRed')[0] || null;

  if (!gRed) return 0.0;

  let pRedAliqStr: string | null = null;
  pRedAliqStr = getElementsByLocalName(gRed, 'pRedAliq')[0]?.textContent || null;

  if (!pRedAliqStr) return 0.0;
  const parsed = parseFloat(pRedAliqStr);
  return isNaN(parsed) ? 0.0 : parsed;
}