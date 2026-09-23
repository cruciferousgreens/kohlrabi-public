'use strict';
/* #566, #567, #569 (persona sweep v1.862): beginner comprehension.
   QA batch (user 2026-09-22): the RPE "?" help button is REMOVED — the
   column header shows the bare RPE/RIR label with no help control, and the
   wireLiveRpeHelp wiring is gone from every card render path. AMRAP pills
   are defined, and the finish-review copy reads complete. Pinned at the
   source level. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const editor=fs.readFileSync(path.join(__dirname,'..','assets','js','workout','workout-editor.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

describe('#566: the RPE "?" help button is gone (QA batch 2026-09-22)',()=>{
  it('the RPE header carries no help button',()=>{
    assert.ok(!editor.includes('class="rpe-help"'),
      'RPE column header must not carry the ? button');
    assert.ok(!editor.includes('aria-label="What is RPE?"'),
      'no RPE help aria-label should remain');
  });
  it('the help wiring is removed from every card render path',()=>{
    assert.ok(!editor.includes('wireLiveRpeHelp'),
      'wireLiveRpeHelp must be fully removed');
  });
  it('the RPE header shows the bare label',()=>{
    assert.ok(editor.includes("<span>${effortMode()==='rir'?'RIR':'RPE'}</span>"),
      'RPE header must show the bare RPE/RIR label');
  });
});

describe('#567: AMRAP is defined where beginners meet it',()=>{
  it('every AMRAP pill carries a definition',()=>{
    const pills=html.match(/<button[^>]*data-(?:workout-focus|rep-preset)="amrap"[^>]*>/g)||[];
    assert.ok(pills.length>=3,'expected at least the workout, program, and settings AMRAP pills, found '+pills.length);
    for(const p of pills){
      assert.ok(p.includes('title="As many reps as possible"'),'pill missing title: '+p.slice(0,80));
      assert.ok(p.includes('aria-label="AMRAP: as many reps as possible"'),'pill missing aria-label: '+p.slice(0,80));
    }
  });
  it('the workout focus help line spells it out visibly',()=>{
    assert.ok(html.includes('AMRAP = as many reps as possible.'),
      'workout focus help must define AMRAP in visible text');
  });
});
