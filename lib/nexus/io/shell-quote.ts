const POSIX_SAFE_TOKEN = /^[A-Za-z0-9_.+:@%/][A-Za-z0-9_.+:@%/-]*$/;

export function shellQuotePosix(value: string): string {
  if (value.length > 0 && POSIX_SAFE_TOKEN.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
