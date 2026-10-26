export class PushError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'PushError';
  }
}

export const safeErrorCode = (error: unknown): string => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return 'internal';
  const code = String(error.code);
  return /^[a-zA-Z0-9_/-]{1,80}$/.test(code) ? code : 'internal';
};
