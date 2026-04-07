import { GSTACK_STATE_ENV_VAR, LEGACY_STATE_ROOT, NEXUS_STATE_ENV_VAR, PRIMARY_STATE_ROOT } from './host-roots';
import {
  LEGACY_DEV_ROOT,
  LEGACY_SUPPORT_NAMESPACE,
  LEGACY_WORKTREE_ROOT,
  PRIMARY_DEV_ROOT,
  PRIMARY_SUPPORT_NAMESPACE,
  PRIMARY_WORKTREE_ROOT,
} from './support-surface';

export { LEGACY_STATE_ROOT, PRIMARY_STATE_ROOT, NEXUS_STATE_ENV_VAR, GSTACK_STATE_ENV_VAR } from './host-roots';
export {
  LEGACY_DEV_ROOT,
  LEGACY_SUPPORT_HELPERS,
  LEGACY_SUPPORT_NAMESPACE,
  LEGACY_WORKTREE_ROOT,
  PRIMARY_DEV_ROOT,
  PRIMARY_SUPPORT_HELPERS,
  PRIMARY_SUPPORT_NAMESPACE,
  PRIMARY_WORKTREE_ROOT,
  SUPPORT_SURFACE_RULES,
} from './support-surface';

export const PRIMARY_PRODUCT_NAME = 'Nexus' as const;
export const PRIMARY_PACKAGE_NAME = 'nexus' as const;
export const PRIMARY_NAMESPACE = 'nexus' as const;

export const LEGACY_COMPAT_NAMESPACE = LEGACY_SUPPORT_NAMESPACE;

export const PRODUCT_SURFACE_RULES = {
  package_identity: PRIMARY_PACKAGE_NAME,
  product_name: PRIMARY_PRODUCT_NAME,
  preferred_namespace: PRIMARY_NAMESPACE,
  legacy_compat_namespace: LEGACY_COMPAT_NAMESPACE,
  primary_support_namespace: PRIMARY_SUPPORT_NAMESPACE,
  legacy_support_namespace: LEGACY_SUPPORT_NAMESPACE,
  primary_state_root: PRIMARY_STATE_ROOT,
  legacy_state_root: LEGACY_STATE_ROOT,
  primary_worktree_root: PRIMARY_WORKTREE_ROOT,
  legacy_worktree_root: LEGACY_WORKTREE_ROOT,
  primary_dev_root: PRIMARY_DEV_ROOT,
  legacy_dev_root: LEGACY_DEV_ROOT,
  nexus_state_env_var: NEXUS_STATE_ENV_VAR,
  gstack_state_env_var: GSTACK_STATE_ENV_VAR,
} as const;
