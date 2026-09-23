'use strict';
/* QA batch (user 2026-09-22): "Remove 'Target' from RPE. Our app doesn't
   work that way. We target weight/reps." The effort field always shows the
   bare RPE/RIR label — never "Target RPE"/"Target RIR" — even when the set
   carries a programmed targetRpe. Pinned at the source level. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const editor=fs.readFileSync(path.join(__dirname,'..','assets','js','workout','workout-editor.js'),'utf8');

describe('RPE/RIR placeholders are bare (QA batch 2026-09-22)',()=>{
  it('effortDisplayPlaceholder returns the bare field name',()=>{
    const m=editor.match(/function effortDisplayPlaceholder\(\)\{([\s\S]*?)\n    \}/);
    assert.ok(m,'effortDisplayPlaceholder found');
    const body=m[1];
    assert.ok(!/Target (RPE|RIR)/i.test(body),'no "Target RPE/RIR" in the placeholder function');
    assert.ok(body.includes("'RIR'")&&body.includes("'RPE'"),'returns RIR/RPE');
  });
  it('no "Target RPE" or "Target RIR" strings remain in the editor',()=>{
    assert.ok(!editor.includes('Target RPE'),'no "Target RPE"');
    assert.ok(!editor.includes('Target RIR'),'no "Target RIR"');
    assert.ok(!editor.includes('target RPE'),'no "target RPE"');
    assert.ok(!editor.includes('target RIR'),'no "target RIR"');
  });
  it('the RPE input aria-label does not append a target qualifier',()=>{
    /* The old code appended `target RPE`/`target RIR` to the accessible
       label; now it is the bare label. */
    assert.ok(!/aria-label=\$\{[^}]*target/i.test(editor),
      'no target-qualified RPE aria-label');
  });
});
