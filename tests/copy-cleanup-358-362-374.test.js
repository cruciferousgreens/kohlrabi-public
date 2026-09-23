'use strict';
/* Source-sniff pins for copy/markup fixes with no testable logic surface:
   #358: the program share toast describes the add path ("find it under
   Archived") instead of telling the user to "restore it".
   #362: the stale StrongLifts 5x5 attribution is gone from Settings
   (the built-in templates were deleted in v1.49).
   #374: the old per-surface equipment fallbacks ('none', 'no equipment')
   are gone — every surface goes through equipmentLabel. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {REPO_ROOT}=require('./harness');

const read=rel=>fs.readFileSync(path.join(REPO_ROOT,rel),'utf8');

describe('share toast copy — #358',()=>{
  const src=read('assets/js/share/share.js');
  it('no longer says "restore it" on the program-add path',()=>{
    assert.ok(!src.includes('restore it from the Program tab'),'stale restore copy is gone');
  });
  it('points at the Saved list where shared programs land (#392)',()=>{
    assert.ok(src.includes('find it under Saved in the Program tab'),'toast names the add destination');
  });
});

describe('attributions — #362',()=>{
  const html=read('index.html');
  it('no stale StrongLifts 5x5 built-in-workout attribution',()=>{
    assert.ok(!html.includes('Built-in saved workout'),'stale StrongLifts line removed');
  });
  it('the other attributions survive',()=>{
    assert.ok(html.includes('free-exercise-db'),'exercise library attribution kept');
    assert.ok(html.includes('Sasha-s-Body-Map'),'body map attribution kept');
  });
});

describe('equipment fallback labels — #374',()=>{
  for(const rel of ['assets/js/pages/exercise-library.js','assets/js/pages/exercise-detail.js','assets/js/workout/workout-builder.js']){
    it(`${rel}: no stale fallback literals`,()=>{
      const src=read(rel);
      assert.ok(!src.includes("|| 'none'"),`'none' fallback gone from ${rel}`);
      assert.ok(!src.includes("|| 'no equipment'"),`'no equipment' fallback gone from ${rel}`);
    });
  }
  it('all picker/detail/library surfaces use equipmentLabel',()=>{
    for(const rel of ['assets/js/pages/exercise-library.js','assets/js/pages/exercise-detail.js','assets/js/workout/workout-builder.js']){
      assert.ok(read(rel).includes('equipmentLabel('),`equipmentLabel used in ${rel}`);
    }
  });
});
