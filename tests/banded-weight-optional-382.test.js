'use strict';
/* #382 (user 2026-09-13): banded exercises treat weight as optional, like
   bodyweight — band resistance is variable and often unknown. Pins the
   shared helper and the three weight-optional gates (row placeholder,
   completion gate, finish validation). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const {exerciseWeightOptional}=loadRole('warmup-ui');

const ROOT=path.resolve(__dirname,'..');
const editorSrc=fs.readFileSync(path.join(ROOT,'assets/js/workout/workout-editor.js'),'utf8');
const historySrc=fs.readFileSync(path.join(ROOT,'assets/js/workout/workout-history.js'),'utf8');

describe('#382 exerciseWeightOptional',()=>{
  it('bands and body-only are weight-optional; loaded exercises are not',()=>{
    assert.equal(exerciseWeightOptional({equipment:'bands'}),true);
    assert.equal(exerciseWeightOptional({equipment:'body only'}),true);
    assert.equal(exerciseWeightOptional({equipment:'barbell'}),false);
    assert.equal(exerciseWeightOptional({equipment:'dumbbell'}),false);
    assert.equal(exerciseWeightOptional({equipment:'cable'}),false);
    assert.equal(exerciseWeightOptional({equipment:'machine'}),false);
    assert.equal(exerciseWeightOptional(null),false);
    assert.equal(exerciseWeightOptional({}),true); /* hotfix 2026-09-15: no equipment recorded → like bodyweight */
  });
});

describe('#382 weight-optional gates',()=>{
  it('the row placeholder says Optional for weight-optional exercises',()=>{
    assert.ok(editorSrc.includes("((weightOptionalEx||tracking==='time')?'Optional':'Weight')"),
      'liveSetRowHtml placeholder covers bands via weightOptionalEx');
  });
  it('the completion gate no longer demands a weight for bands',()=>{
    assert.ok(editorSrc.includes('weightOptional=exerciseWeightOptional(ex)||tracking'),
      'live completion gate uses the shared helper');
  });
  it('finish validation (invalidSetsIn) treats bands as weight-optional',()=>{
    assert.ok(historySrc.includes('weightOptional=exerciseWeightOptional(ex)||tracking'),
      'invalidSetsIn uses the shared helper');
  });
});
