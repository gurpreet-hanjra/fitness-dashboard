export function imageKeyForStartedAt(startedAt: string): string {
  return `${startedAt.replace(/:/g, '-')}.jpg`;
}
