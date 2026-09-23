'use strict';
/* #116: edit-superset flow — verify the grouping logic end to end.
   Cases: create a group of 2 (marker on both), add a third, remove a partner
   (down to one clears the group — normalizeSupersets leaves no singleton
   supersetId), and grouping survives a reorder (supersetId is item-attached,
   not index-attached). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const role=loadRole('superset-logic');
const mkItem=(uid,supersetId=null)=>({uid,exerciseId:'ex-'+uid,supersetId,sets:[]});
const setDraft=(items)=>{role.workoutState.draft={exercises:items};role.state.builderOpen=false;role.state.savedBuilder=null;};

describe('#116: normalizeSupersets',()=>{
  it('clears a singleton group (remove down to one member)',()=>{
    const items=[mkItem('a','g1'),mkItem('b','g1'),mkItem('c')];
    setDraft(items);
    // remove partner b from the group
    items[1].supersetId=null;
    role.normalizeSupersets();
    assert.equal(items[0].supersetId,null,'last remaining member is ungrouped');
    assert.equal(items[1].supersetId,null,'removed partner stays ungrouped');
  });
  it('keeps groups of two or more intact',()=>{
    const items=[mkItem('a','g1'),mkItem('b','g1'),mkItem('c','g2'),mkItem('d','g2'),mkItem('e')];
    setDraft(items);
    role.normalizeSupersets();
    assert.equal(items[0].supersetId,'g1');
    assert.equal(items[1].supersetId,'g1');
    assert.equal(items[2].supersetId,'g2');
    assert.equal(items[3].supersetId,'g2');
    assert.equal(items[4].supersetId,null);
  });
  it('is a no-op with no draft',()=>{
    role.workoutState.draft=null;
    assert.doesNotThrow(()=>role.normalizeSupersets(),'no draft is safe');
  });
});

describe('#116: grouping is item-attached, so reorder cannot break it',()=>{
  it('moving items keeps the group together',()=>{
    const items=[mkItem('a','g1'),mkItem('b'),mkItem('c','g1')];
    setDraft(items);
    // drag 'c' next to 'a' (reorder = array move)
    const [moved]=items.splice(2,1);
    items.splice(1,0,moved);
    role.normalizeSupersets();
    assert.deepEqual(items.map(i=>i.uid),['a','c','b'],'order changed');
    assert.equal(items[0].supersetId,'g1');
    assert.equal(items[1].supersetId,'g1','group survives the reorder');
    assert.equal(items[2].supersetId,null);
  });
});


