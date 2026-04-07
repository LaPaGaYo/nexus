#!/usr/bin/env bun
export { normalizeRemoteUrl, main } from './nexus-global-discover.ts';
import { main } from './nexus-global-discover.ts';

if (import.meta.main) {
  main().catch((err) => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}
