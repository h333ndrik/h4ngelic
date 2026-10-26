import test from 'node:test';
import assert from 'node:assert/strict';
import { flashMannequinConfig, mannequinMaterialRole, renderFlashMannequin } from '../src/flash-mannequin-content.js';

const project = (patch = {}) => ({ category: 'flashes', mannequin: {
  model: '/models/placement.glb', validated: true,
  bodyMaterialNames: ['Body'], tattooMaterialNames: ['Tattoo'], ...patch,
} });

test('a placement needs an actual validated Flash model with separated materials', () => {
  assert.equal(flashMannequinConfig(null), null);
  assert.equal(flashMannequinConfig({ category: 'flashes' }), null);
  assert.equal(flashMannequinConfig({ ...project(), category: 'tattoos' }), null);
  assert.equal(flashMannequinConfig(project({ validated: false })), null);
  assert.equal(flashMannequinConfig(project({ bodyMaterialNames: [] })), null);
  assert.equal(flashMannequinConfig(project({ tattooMaterialNames: [] })), null);
  assert.equal(flashMannequinConfig(project({ tattooMaterialNames: ['Body'] })), null);
  assert.deepEqual(flashMannequinConfig(project()), {
    model: '/models/placement.glb', bodyMaterialNames: ['Body'], tattooMaterialNames: ['Tattoo'],
  });
});

test('a model path must be a safe actual GLB; FBX/USDZ are not silently relabelled', () => {
  for (const model of ['javascript:alert(1).glb', '//untrusted.example/a.glb', '/models/a.fbx', '/models/a.usdz', '/models/a.obj', '']) {
    assert.equal(flashMannequinConfig(project({ model })), null, model);
  }
  assert.equal(flashMannequinConfig(project({ model: 'https://cdn.example/model.GLB?v=1' })).model,
    'https://cdn.example/model.GLB?v=1');
});

test('tattoo and unknown materials are preserved; only the named body is neutralized', () => {
  const config = flashMannequinConfig(project({ bodyMaterialNames: [' Body ', 'Body', null] }));
  assert.deepEqual(config.bodyMaterialNames, ['Body']);
  assert.equal(mannequinMaterialRole('Body', config), 'body');
  assert.equal(mannequinMaterialRole('Tattoo', config), 'tattoo');
  assert.equal(mannequinMaterialRole('UnspecifiedImage', config), 'preserve');
  assert.equal(mannequinMaterialRole('Tattoo', { bodyMaterialNames: ['Tattoo'], tattooMaterialNames: ['Tattoo'] }), 'tattoo');
});

test('unconfigured models add no fake switch; configured markup is escaped and starts flat', () => {
  assert.equal(renderFlashMannequin({ category: 'flashes' }), '');
  const markup = renderFlashMannequin(project({ tattooMaterialNames: ['<Tattoo>"'] }));
  assert.match(markup, /aria-pressed="false"/);
  assert.match(markup, /data-mannequin-view hidden/);
  assert.match(markup, /&lt;Tattoo&gt;/);
  assert.doesNotMatch(markup, /<canvas|<Tattoo>|<script/);
});
