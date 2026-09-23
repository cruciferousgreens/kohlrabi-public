'use strict';
/* #208 (user 2026-09-13): per-exercise rep-range pills in the saved-workout
   builder reuse the program-setup REP_PRESETS. The pills write the preset
   bounds onto the exercise; the range persists on the template, carries into
   the live workout as the target range, and the progression engine respects
   it (same stored-zone machinery as program rep ranges). Leaving the range
   unset (or min==max) behaves exactly as today. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');
const {mkItem,mkLog}=require('./fixtures/logs');

const {
  builderRangePresetKey, applyBuilderRangePreset, rangePlaceholder,
  builderRangePillsHtml, REP_PRESETS, VISIBLE_REP_PRESETS,
}=loadRole('saved-workout-template');

const mkBuilderItem=(overrides={})=>({
  uid:'ex-1', exerciseId:'bench-press', tracking:'reps', note:'',
  progression:null, sets:[{r:'',w:''},{r:'',w:''}], ...overrides,
});

describe('applyBuilderRangePreset (#208)',()=>{
  it('applies the strength preset as a ghost range — no values typed into sets (#353)',()=>{
    const item=mkBuilderItem();
    const p=applyBuilderRangePreset(item,'strength');
    assert.equal(p.preset,'strength');
    assert.equal(p.min,1); assert.equal(p.max,5);
    assert.equal(p.openTop,false); assert.equal(p.amrap,false);
    assert.equal(p.custom,true);
    assert.ok(item.sets.every(s=>s.r===''),'no typed values: '+JSON.stringify(item.sets.map(s=>s.r)));
    assert.deepEqual(rangePlaceholder(p,false),{text:'1–5',value:'1'},
      'the range shows as a ghost; the floor is the untouched-completion fallback');
  });
  it('tapping the active pill clears back to the fixed-reps blank state',()=>{
    const item=mkBuilderItem();
    applyBuilderRangePreset(item,'hypertrophy');
    const p=applyBuilderRangePreset(item,'hypertrophy');
    assert.equal(p.preset,null);
    assert.equal(p.min,null); assert.equal(p.max,null);
    assert.equal(p.openTop,false); assert.equal(p.amrap,false);
    assert.ok(item.sets.every(s=>s.r===''),'set targets cleared');
  });
  it('tapping a different pill switches the range',()=>{
    const item=mkBuilderItem();
    applyBuilderRangePreset(item,'hypertrophy');
    const p=applyBuilderRangePreset(item,'strength');
    assert.equal(p.preset,'strength'); assert.equal(p.min,1); assert.equal(p.max,5);
  });
  it('applies AMRAP (open max); legacy 15+ key still resolves internally',()=>{
    const amrap=applyBuilderRangePreset(mkBuilderItem(),'amrap');
    assert.equal(amrap.amrap,true); assert.equal(amrap.max,null); assert.equal(amrap.min,1);
    /* QA batch (user 2026-09-21, #14): 15+ is hidden from pickers but the old
       key stays resolvable so legacy data keeps working. */
    const legacy=applyBuilderRangePreset(mkBuilderItem(),'open');
    assert.equal(legacy.preset,'open'); assert.equal(legacy.min,15); assert.equal(legacy.openTop,true);
  });
  it('clearing preserves unrelated progression fields',()=>{
    const item=mkBuilderItem({progression:{incrementValue:10,incrementType:'lb'}});
    applyBuilderRangePreset(item,'strength');
    const p=applyBuilderRangePreset(item,'strength');
    assert.equal(p.incrementValue,10,'increment override survives the clear');
  });
});

describe('builderRangePresetKey (#208)',()=>{
  it('matches a pill-applied preset',()=>{
    const item=mkBuilderItem();
    applyBuilderRangePreset(item,'endurance');
    assert.equal(builderRangePresetKey(item),'endurance');
  });
  it('matches a Configure-applied range with identical bounds',()=>{
    const item=mkBuilderItem({progression:{min:6,max:12,openTop:false,amrap:false}});
    assert.equal(builderRangePresetKey(item),'hypertrophy');
  });
  it('returns empty for custom bounds and for no range',()=>{
    assert.equal(builderRangePresetKey(mkBuilderItem({progression:{min:3,max:10,openTop:false,amrap:false}})),'');
    assert.equal(builderRangePresetKey(mkBuilderItem()),'');
  });
  it('ignores a stale preset field when the values were customized',()=>{
    const item=mkBuilderItem({progression:{preset:'strength',min:3,max:10,openTop:false,amrap:false,custom:true}});
    assert.equal(builderRangePresetKey(item),'');
  });
});

describe('fixed-reps path unchanged (#208)',()=>{
  it('min==max still reads as a fixed rep target, with no pill pressed',()=>{
    const item=mkBuilderItem({progression:{min:5,max:5,openTop:false,amrap:false}});
    assert.equal(builderRangePresetKey(item),'');
    assert.deepEqual(rangePlaceholder(item.progression,false),{text:'5',value:'5'});
  });
  it('no range still reads as an empty target',()=>{
    const item=mkBuilderItem();
    assert.deepEqual(rangePlaceholder(item.progression,false),{text:'',value:''});
  });
});

describe('15+ hidden from pickers, preserved internally (user 2026-09-21, #14)',()=>{
  it("VISIBLE_REP_PRESETS excludes 'open' but REP_PRESETS still resolves it",()=>{
    assert.ok(!VISIBLE_REP_PRESETS.includes('open'),'open is not offered');
    assert.deepEqual([...VISIBLE_REP_PRESETS],['strength','hypertrophy','endurance','amrap']);
    assert.equal(REP_PRESETS.open.label,'15+','legacy data still resolves');
    assert.equal(REP_PRESETS.open.min,15);
  });
  it("builderRangePillsHtml renders no 15+ button",()=>{
    const html=builderRangePillsHtml(mkBuilderItem(),{name:'Bench Press'},false,'uid-1');
    assert.ok(!html.includes('15+'),'no 15+ label');
    assert.ok(!html.includes('data-builder-range="open"'),'no open button');
    assert.ok(html.includes('data-builder-range="amrap"'),'AMRAP still offered');
  });
});
