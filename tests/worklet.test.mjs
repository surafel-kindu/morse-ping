import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
test('worklet loads without browser DOM globals and decodes audio while outputting silence',()=>{
  const result=spawnSync(process.execPath,['--experimental-vm-modules',fileURLToPath(new URL('./worklet-harness.mjs',import.meta.url))],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr); assert.match(result.stdout,/integration passed/);
});
