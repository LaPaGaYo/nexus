import { NEXUS_STATE_ENV_VAR, PRIMARY_STATE_ROOT } from '../io/host-roots';
import { PRIMARY_DEV_ROOT, PRIMARY_SUPPORT_NAMESPACE, PRIMARY_WORKTREE_ROOT } from './support-surface';

export { PRIMARY_STATE_ROOT, NEXUS_STATE_ENV_VAR } from '../io/host-roots';
export {
  PRIMARY_DEV_ROOT,
  PRIMARY_SUPPORT_HELPERS,
  PRIMARY_SUPPORT_NAMESPACE,
  PRIMARY_WORKTREE_ROOT,
  SUPPORT_SURFACE_RULES,
} from './support-surface';

export const PRIMARY_PRODUCT_NAME = 'Nexus' as const;
export const PRIMARY_PACKAGE_NAME = 'nexus' as const;
export const PRIMARY_NAMESPACE = 'nexus' as const;

export const PRODUCT_SURFACE_RULES = {
  package_identity: PRIMARY_PACKAGE_NAME,
  product_name: PRIMARY_PRODUCT_NAME,
  preferred_namespace: PRIMARY_NAMESPACE,
  primary_support_namespace: PRIMARY_SUPPORT_NAMESPACE,
  primary_state_root: PRIMARY_STATE_ROOT,
  primary_worktree_root: PRIMARY_WORKTREE_ROOT,
  primary_dev_root: PRIMARY_DEV_ROOT,
  nexus_state_env_var: NEXUS_STATE_ENV_VAR,
} as const;
