'use strict';
/* Role: utilities — pins the pure helpers behind #372 and #374.
   #372: detectBodyweightPRs — bodyweight-only work (unweighted rep sets)
   never fired PRs because estimate1RM is 0 for load-free sets. A rep count
   beats the prior best among UNWEIGHTED sets only.
   #374: equipmentLabel — one fallback label ('No equipment') for exercises
   with no equipment recorded (the library said 'none', the detail page
   'no equipment', the picker 'No equipment'). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {detectBodyweightPRs,equipmentLabel}=loadRole('utilities');

const S=(w,r)=>({w,r,seconds:null,rpe:null,tags:[]});

describe('detectBodyweightPRs — #372 bodyweight rep PRs',()=>{
  it('more unweighted reps than any prior unweighted set → PR',()=>{
    assert.equal(detectBodyweightPRs([S('',12)],[S('',10),S('',8)]),true);
  });
  it('no improvement → no PR',()=>{
    assert.equal(detectBodyweightPRs([S('',9)],[S('',10)]),false);
  });
  it('no prior unweighted work → no PR (first-session rule, like the weighted path)',()=>{
    assert.equal(detectBodyweightPRs([S('',12)],[]),false);
  });
  it('weighted prior sets do not count against a bodyweight PR',()=>{
    assert.equal(detectBodyweightPRs([S('',12)],[S(100,20)]),false); // no unweighted prior → no PR
    assert.equal(detectBodyweightPRs([S('',12)],[S('',10),S(100,20)]),true); // beats the unweighted best
  });
  it('weighted current sets are ignored — they already have their own PR kinds',()=>{
    assert.equal(detectBodyweightPRs([S(25,12)],[S('',10)]),false);
  });
  it('w:0 counts as unweighted',()=>{
    assert.equal(detectBodyweightPRs([S(0,12)],[S(0,10)]),true);
  });
  it('empty current → no PR',()=>{
    assert.equal(detectBodyweightPRs([],[S('',10)]),false);
  });
});

describe('equipmentLabel — #374 unified fallback',()=>{
  it('returns the recorded equipment',()=>{
    assert.equal(equipmentLabel({equipment:'barbell'}),'barbell');
  });
  it('falls back to "No equipment" for missing/blank equipment',()=>{
    assert.equal(equipmentLabel({equipment:''}),'No equipment');
    assert.equal(equipmentLabel({equipment:null}),'No equipment');
    assert.equal(equipmentLabel({}),'No equipment');
    assert.equal(equipmentLabel(null),'No equipment');
  });
});
