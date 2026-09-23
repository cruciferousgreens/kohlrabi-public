'use strict';
/* v1.877 (user 2026-09-21): the exercise picker in saved-workout/template
   mode must not show a grey rounded panel — it should be clean/white like
   prod's "Add exercise". The template-options container keeps its layout
   role (scroll, padding) but its background must be transparent, not
   var(--surface-2). Mode-specific controls (red × remove buttons) are
   untouched — this pins ONLY the panel background. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.resolve(__dirname,'..','assets/styles.css'),'utf8');

function ruleBodies(selector){
  const out=[];let i=0;
  while(true){
    i=css.indexOf(selector,i);if(i<0)break;
    const j=css.indexOf('{',i);if(j<0)break;
    const k=css.indexOf('}',j);if(k<0)break;
    out.push(css.slice(j+1,k));i=k+1;
  }
  return out;
}

describe('v1.877 picker template-options has no grey panel',()=>{
  it('no .picker-template-options rule sets a grey background',()=>{
    const bodies=ruleBodies('.picker-template-options');
    assert.ok(bodies.length>0,'.picker-template-options rule missing');
    for(const b of bodies){
      assert.ok(!/background\s*:\s*var\(--surface-2\)/.test(b),
        `grey panel background found: ${b.slice(0,80)}`);
    }
  });
  it('the container keeps its layout role (not display:none)',()=>{
    const bodies=ruleBodies('.picker-template-options');
    for(const b of bodies){
      assert.ok(!/display\s*:\s*none/.test(b),'template-options must keep its layout role');
    }
  });
});
