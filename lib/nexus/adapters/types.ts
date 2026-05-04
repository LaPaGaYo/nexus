import type {
  ActualRouteRecord,
  ArtifactPointer,
  CanonicalCommandId,
  ConflictRecord,
  RequestedRouteRecord,
  ReviewScopeRecord,
  RunLedger,
  WorkspaceRecord,
} from '../types';
import type { CommandContract } from '../command-manifest';
import type { StagePackTraceability } from '../stage-packs/types';

export type AdapterActivationState = 'inactive' | 'reserved_future' | 'active';
export type AdapterKind = 'stub' | 'runtime';

interface NexusAdapterMarker {
  readonly kind: AdapterKind;
}

export interface NexusAdapterContext {
  cwd: string;
  workspace?: WorkspaceRecord | null;
  run_id: string;
  command: CanonicalCommandId;
  stage: CanonicalCommandId;
  ledger: RunLedger;
  manifest: CommandContract;
  predecessor_artifacts: ArtifactPointer[];
  requested_route: RequestedRouteRecord | null;
  review_scope?: ReviewScopeRecord | null;
  review_attempt_id?: string | null;
}

export interface AdapterTraceability extends StagePackTraceability {
  absorbed_capability: string;
}

export interface AdapterResult<TRaw> {
  adapter_id: string;
  outcome: 'success' | 'blocked' | 'refused' | 'error';
  raw_output: TRaw;
  requested_route: RequestedRouteRecord | null;
  actual_route: ActualRouteRecord | null;
  notices: string[];
  conflict_candidates: ConflictRecord[];
  traceability?: AdapterTraceability;
}

export interface DiscoveryAdapter extends NexusAdapterMarker {
  discover(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  frame(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
}

export interface PlanningAdapter extends NexusAdapterMarker {
  plan(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  closeout(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
}

export interface ExecutionAdapter extends NexusAdapterMarker {
  build_discipline(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  review_discipline(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  ship_discipline(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
}

export interface CcbAdapter extends NexusAdapterMarker {
  resolve_route(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_generator(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_audit_a(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_audit_b(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_qa(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
}

export interface LocalAdapter extends NexusAdapterMarker {
  resolve_route(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_generator(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_audit_a(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_audit_b(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_qa(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_ship_personas(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
}

export interface AdapterRegistryShape {
  discover: { discovery: AdapterActivationState };
  frame: { discovery: AdapterActivationState };
  plan: { planning: AdapterActivationState };
  handoff: { ccb: AdapterActivationState; local: AdapterActivationState };
  build: { execution: AdapterActivationState; ccb: AdapterActivationState; local: AdapterActivationState };
  review: { execution: AdapterActivationState; ccb: AdapterActivationState; local: AdapterActivationState };
  qa: { ccb: AdapterActivationState; local: AdapterActivationState };
  ship: { execution: AdapterActivationState; local: AdapterActivationState };
  closeout: { planning: AdapterActivationState };
}

export interface NexusAdapters {
  registry: AdapterRegistryShape;
  discovery: DiscoveryAdapter;
  planning: PlanningAdapter;
  execution: ExecutionAdapter;
  ccb: CcbAdapter;
  local: LocalAdapter;
}
