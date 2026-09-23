'use strict';
/* #467: the live-workout exercise picker resolves the workout's focus pill
   through REP_PRESETS — exercises added after a focus is set inherit the
   focus range (Strength 1–5), not the global Settings default. Falls back
   to progressionSetup.defaultRange when the workout has no focus. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {focusPresetRange,builderPickerDefaultRange,state,progressionSetup}=
  loadRole('picker-scroll');

describe('focusPresetRange (#467)',()=>{
  it('resolves the Strength focus key to its stamped range',()=>{
    assert.deepEqual(focusPresetRange('strength'),
      {preset:'strength',min:1,max:5,openTop:false,amrap:false,custom:true});
  });
  it('resolves hypertrophy; legacy 15+ key still resolves internally',()=>{
    assert.deepEqual(focusPresetRange('hypertrophy'),
      {preset:'hypertrophy',min:6,max:12,openTop:false,amrap:false,custom:true});
    /* QA batch (user 2026-09-21, #14): 15+ is hidden from pickers but the old
       key stays resolvable so legacy data keeps working. */
    assert.deepEqual(focusPresetRange('open'),
      {preset:'open',min:15,max:null,openTop:true,amrap:false,custom:true});
  });
  it('returns null with no focus or an unknown key',()=>{
    assert.equal(focusPresetRange(null),null);
    assert.equal(focusPresetRange(''),null);
    assert.equal(focusPresetRange('bogus'),null);
  });
});

describe('builderPickerDefaultRange (#467)',()=>{
  it('uses the saved-builder focus key when set',()=>{
    state.savedBuilder={id:'b1',name:'W',focusKey:'strength',exercises:[],editTarget:null};
    const r=builderPickerDefaultRange();
    assert.equal(r.preset,'strength');
    assert.equal(r.min,1);assert.equal(r.max,5);assert.equal(r.custom,true);
  });
  it('falls back to the Settings default with no focus',()=>{
    state.savedBuilder={id:'b1',name:'W',focusKey:null,exercises:[],editTarget:null};
    assert.equal(builderPickerDefaultRange(),progressionSetup.defaultRange);
  });
});
