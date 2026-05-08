import { documentedLifecycleEntrypoints } from '../contracts/command-manifest';

export function isDocumentedLifecycleEntrypoint(name: string): boolean {
  return documentedLifecycleEntrypoints().includes(name);
}

export function assertCanonicalLifecycleEntrypoint(name: string): void {
  if (isDocumentedLifecycleEntrypoint(name)) {
    return;
  }

  throw new Error(`Non-canonical lifecycle entrypoint refused: ${name}`);
}
