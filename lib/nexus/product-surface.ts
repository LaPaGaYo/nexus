import { GSTACK_STATE_ENV_VAR, LEGACY_STATE_ROOT, NEXUS_STATE_ENV_VAR, PRIMARY_STATE_ROOT } from './host-roots';

export { LEGACY_STATE_ROOT, PRIMARY_STATE_ROOT, NEXUS_STATE_ENV_VAR, GSTACK_STATE_ENV_VAR } from './host-roots';

export const PRIMARY_PRODUCT_NAME = 'Nexus' as const;
export const PRIMARY_PACKAGE_NAME = 'nexus' as const;
export const PRIMARY_NAMESPACE = 'nexus' as const;

export const LEGACY_COMPAT_NAMESPACE = 'gstack' as const;

export const PRODUCT_SURFACE_RULES = {
  package_identity: PRIMARY_PACKAGE_NAME,
  product_name: PRIMARY_PRODUCT_NAME,
  preferred_namespace: PRIMARY_NAMESPACE,
  legacy_compat_namespace: LEGACY_COMPAT_NAMESPACE,
  primary_state_root: PRIMARY_STATE_ROOT,
  legacy_state_root: LEGACY_STATE_ROOT,
  nexus_state_env_var: NEXUS_STATE_ENV_VAR,
  gstack_state_env_var: GSTACK_STATE_ENV_VAR,
} as const;
