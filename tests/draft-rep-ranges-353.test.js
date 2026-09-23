'use strict';
/* #353: rep ranges in saved-workout drafts are ghosts, not typed values, and
   per-exercise Configure customizations win over the workout-focus pills.
   applyBuilderFocus writes the range onto the progression profile — the pill
   sets the range, never types values into sets — and leaves exercises
   hand-tuned in Configure untouched, reporting the split in its return
   counts ({applied,skipped}) instead of silently clobbering. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const catalog=[
  {id:'bench-press',name:'Bench Press',tracking:'reps'},
  {id:'plank',name:'Plank',tracking:'time'},
];
const {
  applyBuilderFocus, applyBuilderRangePreset, builderExerciseHasCustomRange,
  rangePlaceholder, state,
}=loadRole('saved-workout-template',{globals:{exercises:catalog,schedulePersist:()=>{}}});

let uidN=0;
const mkItem=(overrides={})=>({
  uid:'ex-'+(++uidN), exerciseId:'bench-press', tracking:'reps', note:'',
  progression:null, sets:[{r:'',w:''},{r:'',w:''}], ...overrides,
});
const openBuilder=(items)=>{
  state.savedBuilder={id:'t1',name:'W',focusKey:null,exercises:items,editTarget:null};
};

describe('builderExerciseHasCustomRange (#353)',()=>{
  it('is false with no progression or a non-custom profile',()=>{
    assert.equal(builderExerciseHasCustomRange(mkItem()),false);
    assert.equal(builderExerciseHasCustomRange(mkItem({progression:{min:6,max:12,openTop:false,amrap:false}})),false);
  });
  it('is false for a pill-stamped range (preset in sync with the bounds)',()=>{
    const item=mkItem({progression:{preset:'hypertrophy',min:6,max:12,openTop:false,amrap:false,custom:true}});
    assert.equal(builderExerciseHasCustomRange(item),false);
  });
  it('is true for a Configure-typed range, even when the bounds match a preset',()=>{
    /* The Configure dialog never writes `preset` — bounds of 6–12 with no
       stamped preset is hand-tuned work, not a pill tap. */
    const item=mkItem({progression:{min:6,max:12,openTop:false,amrap:false,custom:true}});
    assert.equal(builderExerciseHasCustomRange(item),true);
  });
  it('is true when Configure rewrote a pill-stamped range (stale preset)',()=>{
    const item=mkItem({progression:{preset:'strength',min:8,max:12,openTop:false,amrap:false,custom:true}});
    assert.equal(builderExerciseHasCustomRange(item),true);
  });
  it('is true for a Configure-cleared range',()=>{
    const item=mkItem({progression:{min:null,max:null,openTop:false,amrap:false,custom:true}});
    assert.equal(builderExerciseHasCustomRange(item),true);
  });
});

describe('applyBuilderFocus ghost convention (#353)',()=>{
  it('sets the range on the profile without typing values into sets',()=>{
    const items=[mkItem(),mkItem()];
    openBuilder(items);
    const counts=applyBuilderFocus('hypertrophy');
    assert.equal(state.savedBuilder.focusKey,'hypertrophy');
    for(const item of items){
      const p=item.progression;
      assert.equal(p.preset,'hypertrophy');
      assert.equal(p.min,6); assert.equal(p.max,12);
      assert.equal(p.custom,true);
      assert.ok(item.sets.every(s=>s.r===''),'no typed values: '+JSON.stringify(item.sets.map(s=>s.r)));
      assert.deepEqual(rangePlaceholder(p,false),{text:'6–12',value:'6'},
        'the range shows as a ghost; the floor is the untouched-completion fallback');
    }
    assert.deepEqual(counts,{applied:2,skipped:0});
  });
  it('AMRAP leaves sets blank and ghosts AMRAP with no auto value',()=>{
    const item=mkItem();
    openBuilder([item]);
    applyBuilderFocus('amrap');
    assert.equal(item.progression.amrap,true);
    assert.ok(item.sets.every(s=>s.r===''),'AMRAP never types values');
    assert.deepEqual(rangePlaceholder(item.progression,false),{text:'AMRAP',value:''});
  });
  it('leaves time-tracked exercises untouched',()=>{
    const plank=mkItem({exerciseId:'plank',tracking:'time',progression:{timeMin:30,timeMax:60}});
    const bench=mkItem();
    openBuilder([plank,bench]);
    const counts=applyBuilderFocus('strength');
    assert.deepEqual(plank.progression,{timeMin:30,timeMax:60});
    assert.equal(bench.progression.preset,'strength');
    assert.deepEqual(counts,{applied:1,skipped:0});
  });
  it('never writes into or wipes values already typed in sets',()=>{
    const item=mkItem({sets:[{r:'8',w:''},{r:'',w:''}]});
    openBuilder([item]);
    applyBuilderFocus('hypertrophy');
    assert.deepEqual(item.sets.map(s=>s.r),['8','']);
  });
  it('tapping the active pill clears the focus without touching ranges',()=>{
    const item=mkItem({progression:{preset:'strength',min:1,max:5,openTop:false,amrap:false,custom:true}});
    openBuilder([item]);
    state.savedBuilder.focusKey='strength';
    const counts=applyBuilderFocus('strength');
    assert.equal(state.savedBuilder.focusKey,null);
    assert.equal(item.progression.preset,'strength');
    assert.deepEqual(counts,{applied:0,skipped:0});
  });
});

describe('applyBuilderFocus Configure precedence (#353)',()=>{
  it('leaves Configure-customized exercises alone and reports the split',()=>{
    const plain=mkItem();
    const tuned=mkItem({progression:{min:8,max:10,openTop:false,amrap:false,custom:true}});
    openBuilder([plain,tuned]);
    const counts=applyBuilderFocus('strength');
    assert.equal(plain.progression.preset,'strength');
    assert.equal(plain.progression.min,1); assert.equal(plain.progression.max,5);
    assert.equal(tuned.progression.preset,undefined,'no pill stamp on the tuned exercise');
    assert.equal(tuned.progression.min,8); assert.equal(tuned.progression.max,10);
    assert.ok(tuned.sets.every(s=>s.r===''),'tuned sets untouched');
    assert.deepEqual(counts,{applied:1,skipped:1});
  });
  it('a stale pill preset rewritten in Configure is protected',()=>{
    const item=mkItem({progression:{preset:'strength',min:8,max:12,openTop:false,amrap:false,custom:true}});
    openBuilder([item]);
    const counts=applyBuilderFocus('hypertrophy');
    assert.equal(item.progression.min,8); assert.equal(item.progression.max,12);
    assert.equal(item.progression.preset,'strength','stale preset left as-is');
    assert.deepEqual(counts,{applied:0,skipped:1});
  });
  it('a per-exercise pill tap hands the range back to pill control',()=>{
    /* Visible precedence chain: Configure protects the range; tapping a
       per-exercise pill re-stamps it in sync, so the global pill applies
       again. */
    const item=mkItem({progression:{min:8,max:10,openTop:false,amrap:false,custom:true}});
    applyBuilderRangePreset(item,'strength');
    openBuilder([item]);
    const counts=applyBuilderFocus('hypertrophy');
    assert.equal(item.progression.preset,'hypertrophy');
    assert.equal(item.progression.min,6); assert.equal(item.progression.max,12);
    assert.deepEqual(counts,{applied:1,skipped:0});
  });
});
