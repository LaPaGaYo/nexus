import { describe, expect, test } from 'bun:test';
import {
  assertLegalTransition,
  getAllowedNextStages,
} from '../../../lib/nexus/governance/transitions';

describe('nexus transitions', () => {
  test('projects the governed slice in order', () => {
    expect(getAllowedNextStages('plan')).toEqual(['handoff']);
    expect(getAllowedNextStages('handoff')).toEqual(['handoff', 'build']);
    expect(getAllowedNextStages('build')).toEqual(['review']);
    expect(getAllowedNextStages('review')).toEqual(['handoff', 'build', 'review', 'qa', 'ship', 'closeout']);
    expect(getAllowedNextStages('qa')).toEqual(['qa', 'build', 'ship', 'closeout']);
    expect(getAllowedNextStages('ship')).toEqual(['closeout']);
  });

  test('rejects closeout before review', () => {
    expect(() => assertLegalTransition('build', 'closeout')).toThrow('Illegal Nexus transition');
  });

  test('allows governed tail transitions through qa and ship', () => {
    expect(() => assertLegalTransition('handoff', 'handoff')).not.toThrow();
    expect(() => assertLegalTransition('review', 'handoff')).not.toThrow();
    expect(() => assertLegalTransition('review', 'build')).not.toThrow();
    expect(() => assertLegalTransition('review', 'review')).not.toThrow();
    expect(() => assertLegalTransition('review', 'qa')).not.toThrow();
    expect(() => assertLegalTransition('review', 'ship')).not.toThrow();
    expect(() => assertLegalTransition('qa', 'qa')).not.toThrow();
    expect(() => assertLegalTransition('qa', 'build')).not.toThrow();
    expect(() => assertLegalTransition('qa', 'ship')).not.toThrow();
    expect(() => assertLegalTransition('qa', 'closeout')).not.toThrow();
    expect(() => assertLegalTransition('ship', 'closeout')).not.toThrow();
  });
});
