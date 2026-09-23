'use strict';
/* #563 (persona sweep v1.862): share-imported custom exercises must resolve
   immediately — the catalog's id→entry map cached by array identity, so the
   in-place unshift in importShareCustomExercises left it stale until reload. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const role=loadRole('share-import-logic');
const {resolveExercise,importShareCustomExercises,state,exercises,invalidateExerciseMap}=role;

beforeEach(()=>{
  /* Reset the catalog mutation between tests. */
  for(let i=exercises.length-1;i>=0;i--)if(exercises[i].custom)exercises.splice(i,1);
  state.customExercises.length=0;
  invalidateExerciseMap();
});

describe('#563: share-imported custom exercises resolve without a reload',()=>{
  it('an imported custom exercise resolves immediately',()=>{
    /* Prime the map cache the way a warm app session would. */
    resolveExercise('bench-press');
    const n=importShareCustomExercises({customExercises:[{id:'my-lift',name:'My Lift'}]});
    assert.equal(n,1);
    const found=resolveExercise('my-lift');
    assert.ok(found,'imported exercise resolves without reload');
    assert.equal(found.name,'My Lift');
  });
  it('re-importing the same exercise is a no-op',()=>{
    importShareCustomExercises({customExercises:[{id:'my-lift',name:'My Lift'}]});
    const n=importShareCustomExercises({customExercises:[{id:'my-lift',name:'My Lift'}]});
    assert.equal(n,0);
  });
  it('entries without ids are skipped',()=>{
    const n=importShareCustomExercises({customExercises:[{name:'No Id'}]});
    assert.equal(n,0);
  });
});
