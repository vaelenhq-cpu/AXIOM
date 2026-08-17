function randomPart(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function generateId(prefix: string): string {
  return `${prefix}_${randomPart()}`;
}
