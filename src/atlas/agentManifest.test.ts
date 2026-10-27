/**
 * The Atlas's agent actions (doc 149): the manifest's declaration passes the
 * HOST's own check, every declared action has its handler in
 * AtlasAgentActions.tsx and no handler is undeclared (a declared action
 * without one would be offered to agents and fail), and nothing here spends.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {agentActionsFromManifest, agentGuideFromManifest} from '../../../infinity-edition/src/main/plugins/cartridgeAgentActions';
import {SYSTEMS} from './anatomy';

const root = join(__dirname, '..', '..');
const manifest = JSON.parse(readFileSync(join(root, 'mnemo-plugin.json'), 'utf8')) as unknown;
const source = readFileSync(join(root, 'src', 'atlas', 'AtlasAgentActions.tsx'), 'utf8');
const block = source.slice(source.indexOf('sdk.onAgentActions({'), source.indexOf('sub.ready.catch'));
const handlers = [...block.matchAll(/^ {6}(\w+): (?:async )?\(/gm)].map((m) => m[1]);

const declared = () => {
  const r = agentActionsFromManifest(manifest);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe('the Atlas\'s agent actions', () => {
  it('pass the host\'s check of the manifest', () => {
    const r = agentActionsFromManifest(manifest);
    expect(r.ok ? 'ok' : r.error).toBe('ok');
  });

  it('every declared action has its handler, and no handler is undeclared', () => {
    expect(handlers.length).toBeGreaterThan(5);
    expect([...handlers].sort()).toEqual(declared().map((a) => a.id).sort());
  });

  it('carry a guide the host keeps (an over-long guide is dropped whole, review instructions with it)', () => {
    expect(agentGuideFromManifest(manifest)).toContain('reviewAnswer');
  });

  it('spend nothing: no credits are used by any of them', () => {
    expect(declared().filter((a) => a.effect === 'spend')).toEqual([]);
  });

  it('name every system the atlas has, so an agent is not left without one', () => {
    const details = declared().find((a) => a.id === 'showSystems')?.details ?? '';
    expect(SYSTEMS.map((s) => s.id).filter((id) => !new RegExp(`\\b${id}\\b`).test(details))).toEqual([]);
  });
});
