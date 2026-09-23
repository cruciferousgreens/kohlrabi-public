'use strict';
/* user 2026-09-17: the Add-exercise sheet's selected-rules block rendered as
   a ~45px scroll-slice — the selected exercise name scrolled out of view and
   the × clipped at the box edge. Root cause: in the picker dialog's flex
   column the rules block carried flex: 0 1 auto, so the long results list's
   flex pressure shrank it below its content height (overflow-y turned the
   overflow into a broken inner scroll instead of sizing the box to the row).
   Pins: the rules block never shrinks (flex: 0 0 auto); the many-selections
   cap (max-height + internal scroll on .picker-template-options) is intact;
   the results list remains the flexible scroller. Source-text assertions on
   styles.css, following the #98 pattern. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.resolve(__dirname,'..','assets/styles.css'),'utf8');

function ruleBlock(selector){
  const i=css.indexOf(selector);
  assert.ok(i>-1,`${selector} rule exists`);
  const end=css.indexOf('}',i);
  return css.slice(i,end);
}

describe('add-exercise rules block never shrink-squashes (user 2026-09-17)',()=>{
  it('#pickerTemplateOptions has flex-shrink 0 — it sizes to its rows',()=>{
    const block=ruleBlock('#exercisePickerDialog #pickerTemplateOptions');
    assert.ok(/flex:\s*0\s+0\s+auto/.test(block),'flex: 0 0 auto (never shrinks, never grows)');
    assert.ok(!/flex:\s*0\s+1\s+auto/.test(block),'the old shrinkable flex is gone');
  });
  it('.picker-template-options keeps its own scroller for many selections',()=>{
    const block=ruleBlock('.picker-template-options {');
    assert.ok(block.includes('max-height'),'max-height cap survives');
    assert.ok(block.includes('overflow-y'),'internal scroll survives');
  });
  it('.picker-list stays the flexible scroller that absorbs dialog space',()=>{
    const block=ruleBlock('#exercisePickerDialog .picker-list');
    assert.ok(/flex:\s*1\s+1\s+auto/.test(block),'the results list still flexes');
  });
  it('the rules block is a real element in the picker dialog',()=>{
    const html=fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
    assert.ok(html.includes('id="pickerTemplateOptions"'),'rules block exists in the dialog');
  });
});
