export function resolveRuntimeCwd(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): string {
  const overridden = env.NEXUS_PROJECT_CWD?.trim();
  if (overridden && overridden.length > 0) {
    return overridden;
  }

  return cwd;
}
