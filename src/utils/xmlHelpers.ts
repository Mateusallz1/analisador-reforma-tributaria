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
    return new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)));
  } catch {
    return null;
  }
}

export function getTagValue(parent: Element | Document | null, tagName: string): string | null {
  if (!parent) return null;
  const elements = parent.getElementsByTagName(tagName);
  if (elements && elements.length > 0) {
    return elements[0].textContent;
  }
  return null;
}

export function extractPRedAliq(itemElement: Element, groupName: string): number {
  if (!itemElement) return 0.0;

  let group: Element | null = null;
  const groups = itemElement.getElementsByTagName(groupName);
  if (groups && groups.length > 0) {
    group = groups[0];
  } else {
    const allDescendants = itemElement.getElementsByTagName('*');
    const groupLower = groupName.toLowerCase();
    for (let i = 0; i < allDescendants.length; i++) {
      if (allDescendants[i].tagName.toLowerCase() === groupLower) {
        group = allDescendants[i];
        break;
      }
    }
  }

  if (!group && itemElement.parentElement) {
    const parentGroups = itemElement.parentElement.getElementsByTagName(groupName);
    if (parentGroups && parentGroups.length > 0) {
      group = parentGroups[0];
    } else {
      const parentDescendants = itemElement.parentElement.getElementsByTagName('*');
      const groupLower = groupName.toLowerCase();
      for (let i = 0; i < parentDescendants.length; i++) {
        if (parentDescendants[i].tagName.toLowerCase() === groupLower) {
          group = parentDescendants[i];
          break;
        }
      }
    }
  }

  if (!group) return 0.0;

  let gRed: Element | null = null;
  const gReds = group.getElementsByTagName('gRed');
  if (gReds && gReds.length > 0) {
    gRed = gReds[0];
  } else {
    const allInGroup = group.getElementsByTagName('*');
    for (let i = 0; i < allInGroup.length; i++) {
      if (allInGroup[i].tagName.toLowerCase() === 'gred') {
        gRed = allInGroup[i];
        break;
      }
    }
  }

  if (!gRed) return 0.0;

  let pRedAliqStr: string | null = null;
  const pRedAliqs = gRed.getElementsByTagName('pRedAliq');
  if (pRedAliqs && pRedAliqs.length > 0) {
    pRedAliqStr = pRedAliqs[0].textContent;
  } else {
    const allInGRed = gRed.getElementsByTagName('*');
    for (let i = 0; i < allInGRed.length; i++) {
      if (allInGRed[i].tagName.toLowerCase() === 'predaliq') {
        pRedAliqStr = allInGRed[i].textContent;
        break;
      }
    }
  }

  if (!pRedAliqStr) return 0.0;
  const parsed = parseFloat(pRedAliqStr);
  return isNaN(parsed) ? 0.0 : parsed;
}