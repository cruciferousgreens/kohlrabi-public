'use strict';
/* #458 (user 2026-09-14): selecting exercises from the blank-workout picker
   grew the selected-exercises tray unbounded; past a few selections the dialog
   box escaped above the viewport top and the header + first tray cards became
   permanently unreachable — no scroll gesture brought them back. The dialog
   box is now pinned with explicit top/bottom, and the tray is capped at 32vh
   with its own scroll. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');
const builderSrc=fs.readFileSync(path.join(ROOT,'assets/js/workout/workout-builder.js'),'utf8');

function ruleBody(selector){
  const i=css.indexOf(selector+' {');
  assert.ok(i>=0,selector+' rule exists');
  const open=css.indexOf('{',i),close=css.indexOf('}',open);
  return css.slice(open+1,close);
}

describe('exercise picker dialog stays on screen with many selections (#458)',()=>{
  it('pins the picker dialog box with explicit top/bottom so it cannot park above the viewport',()=>{
    const body=ruleBody('#exercisePickerDialog');
    assert.ok(/top\s*:\s*14px/.test(body),'dialog box has top: 14px');
    assert.ok(/bottom\s*:\s*14px/.test(body),'dialog box has bottom: 14px');
  });
  it('caps the selected-exercises tray at 32vh with its own scroll instead of growing unbounded',()=>{
    const body=ruleBody('.picker-template-options');
    assert.ok(/max-height\s*:\s*32vh/.test(body),'tray max-height: 32vh');
    assert.ok(/overflow-y\s*:\s*auto/.test(body),'tray scrolls internally');
  });
  it('the dialog itself remains the outer scroller with a viewport cap',()=>{
    const body=ruleBody('.custom-dialog');
    assert.ok(/overflow\s*:\s*auto/.test(body),'dialog keeps overflow: auto');
    assert.ok(/max-height\s*:\s*calc\(100dvh - 28px\)/.test(body),'dialog keeps its max-height cap');
  });
  it('the tap anchoring shifts the list scroller, never the dialog (so the header cannot be buried)',()=>{
    /* #458: dialog.scrollTop+=delta accumulated with every tap and pushed the
       header above the viewport. The displacement now goes on the list's own
       scroller. Source-audit because the handler is DOM-inline. */
    assert.ok(builderSrc.includes("list.scrollTop+=button.getBoundingClientRect().top-anchorTop"),
      'anchoring targets #exercisePickerList scrollTop');
    assert.ok(!builderSrc.includes("dialog.scrollTop+=button.getBoundingClientRect().top-anchorTop"),
      'anchoring no longer targets the dialog scrollTop');
  });
  it('the main exercise list keeps its own bounded scroller',()=>{
    const body=ruleBody('.picker-list');
    assert.ok(/max-height\s*:\s*48vh/.test(body),'list keeps max-height: 48vh');
    assert.ok(/overflow-y\s*:\s*auto/.test(body),'list keeps overflow-y: auto');
  });
});
