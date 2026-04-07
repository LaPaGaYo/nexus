import type {
  ActualRouteRecord,
  ArtifactPointer,
  CanonicalCommandId,
  ConflictRecord,
  RequestedRouteRecord,
  RunLedger,
} from '../types';
import type { CommandContract } from '../command-manifest';
import type { StagePackTraceability } from '../stage-packs/types';

export type AdapterActivationState = 'inactive' | 'reserved_future' | 'active';

export interface NexusAdapterContext {
  cwd: string;
  run_id: string;
  command: CanonicalCommandId;
  stage: CanonicalCommandId;
  ledger: RunLedger;
  manifest: CommandContract;
  predecessor_artifacts: ArtifactPointer[];
  requested_route: RequestedRouteRecord | null;
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

export interface PmAdapter {
  discover(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  frame(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
}

export interface GsdAdapter {
  plan(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  closeout(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
}

export interface SuperpowersAdapter {
  build_discipline(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  review_discipline(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  ship_discipline(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
}

export interface CcbAdapter {
  resolve_route(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_generator(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_audit_a(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
  execute_audit_b(ctx: NexusAdapterContext): Promise<AdapterResult<unknown>>;
}

export interface AdapterRegistryShape {
  discover: { pm: AdapterActivationState };
  frame: { pm: AdapterActivationState };
  plan: { gsd: AdapterActivationState };
  handoff: { ccb: AdapterActivationState };
  build: { superpowers: AdapterActivationState; ccb: AdapterActivationState };
  review: { superpowers: AdapterActivationState; ccb: AdapterActivationState };
  ship: { superpowers: AdapterActivationState };
  closeout: { gsd: AdapterActivationState };
}

export interface NexusAdapters {
  registry: AdapterRegistryShape;
  pm: PmAdapter;
  gsd: GsdAdapter;
  superpowers: SuperpowersAdapter;
  ccb: CcbAdapter;
}
