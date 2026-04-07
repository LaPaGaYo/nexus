export const PRIMARY_PRODUCT_NAME = 'Nexus' as const;
export const PRIMARY_PACKAGE_NAME = 'nexus' as const;
export const PRIMARY_NAMESPACE = 'nexus' as const;

export const LEGACY_COMPAT_NAMESPACE = 'gstack' as const;
export const LEGACY_STATE_ROOT = '.gstack' as const;

export const PRODUCT_SURFACE_RULES = {
  package_identity: PRIMARY_PACKAGE_NAME,
  product_name: PRIMARY_PRODUCT_NAME,
  preferred_namespace: PRIMARY_NAMESPACE,
  legacy_compat_namespace: LEGACY_COMPAT_NAMESPACE,
  legacy_state_root: LEGACY_STATE_ROOT,
} as const;
