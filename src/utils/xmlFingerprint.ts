export function normalizeXmlForFingerprint(xmlText: string): string {
  return xmlText
    .replace(/\r\n?/g, '\n')
    .replace(/>\s+</g, '><')
    .trim();
}

export function getXmlFingerprint(xmlText: string): string {
  const normalizedXml = normalizeXmlForFingerprint(xmlText);
  let hash = 14695981039346656037n;

  for (let index = 0; index < normalizedXml.length; index += 1) {
    hash ^= BigInt(normalizedXml.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }

  return hash.toString(16).padStart(16, '0');
}
