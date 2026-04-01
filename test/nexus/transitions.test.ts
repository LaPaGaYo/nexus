import { describe, expect, test } from 'bun:test';
import {
  assertLegalTransition,
  getAllowedNextStages,
} from '../../lib/nexus/transitions';

describe('nexus transitions', () => {
  test('projects the governed slice in order', () => {
    expect(getAllowedNextStages('plan')).toEqual(['handoff']);
    expect(getAllowedNextStages('handoff')).toEqual(['build']);
    expect(getAllowedNextStages('build')).toEqual(['review']);
    expect(getAllowedNextStages('review')).toEqual(['closeout']);
  });

  test('rejects closeout before review', () => {
    expect(() => assertLegalTransition('build', 'closeout')).toThrow('Illegal Nexus transition');
  });
});
