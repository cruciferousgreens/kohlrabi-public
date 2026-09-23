'use strict';
/* Role: picker-scroll — pins the #510 rules (user 2026-09-16):
   (1) the page behind the add-exercise modal must not move while the modal
   is open — lockPickerBackground() pins the body with position:fixed and
   unlockPickerBackground() (wired to the dialog's close event, so it runs on
   every close path) restores the exact pre-open scroll position;
   (2) the modal has a fixed size with internal list scrolling — pinned by
   grepping the stylesheet for the fixed-frame rules. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const role=loadRole('picker-scroll');
const {lockPickerBackground,unlockPickerBackground,workoutState}=role;

let fakeY=500;
let scrolledTo=null;
Object.defineProperty(role.window,'scrollY',{get:()=>fakeY,configurable:true});
role.window.scrollTo=(x,y)=>{scrolledTo=[x,y];};
const bodyStyle=()=>role.document.body.style;

beforeEach(()=>{
  fakeY=500;scrolledTo=null;
  unlockPickerBackground();scrolledTo=null; /* clear any lock left by the previous test */
  delete workoutState.pickerScrollY;
});

describe('lockPickerBackground (#510: background must not move)',()=>{
  it('pins the body with position:fixed at the current scroll offset',()=>{
    lockPickerBackground();
    const s=bodyStyle();
    assert.equal(s.position,'fixed');
    assert.equal(s.top,'-500px');
    assert.equal(s.width,'100%');
    assert.equal(s.overscrollBehavior,'none');
  });
  it('records the pre-open position where #192 close-restore looks',()=>{
    lockPickerBackground();
    assert.equal(workoutState.pickerScrollY,500);
  });
  it('a second lock is a no-op — the saved position never drifts mid-modal',()=>{
    lockPickerBackground();
    fakeY=900;
    lockPickerBackground();
    assert.equal(bodyStyle().top,'-500px');
    assert.equal(workoutState.pickerScrollY,500);
  });
  it('unlock restores body styles and scrolls back to the saved position',()=>{
    lockPickerBackground();
    fakeY=0; /* while locked the window reports 0 — restore must use the saved Y */
    unlockPickerBackground();
    const s=bodyStyle();
    assert.equal(s.position,'');
    assert.equal(s.top,'');
    assert.equal(s.width,'');
    assert.deepEqual(scrolledTo,[0,500]);
  });
  it('unlock without a lock is a silent no-op',()=>{
    unlockPickerBackground();
    assert.equal(scrolledTo,null);
    assert.equal(bodyStyle().position,'');
  });
});

describe('#exercisePickerDialog fixed frame (#510: fixed size, internal scroll)',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','assets','styles.css'),'utf8');
  it('gives the dialog a fixed height instead of content-driven sizing',()=>{
    assert.match(css,/#exercisePickerDialog\s*\{[^}]*height:\s*min\(640px,\s*calc\(100dvh - 56px\)\)/);
    /* #458's top/bottom pin survives the merge — the fixed box still anchors
       at the top instead of auto-centering above the viewport. */
    assert.match(css,/#exercisePickerDialog\s*\{[^}]*top:\s*14px/);
    assert.match(css,/#exercisePickerDialog\s*\{[^}]*bottom:\s*14px/);
  });
  it('clips at the dialog frame so only the list scrolls',()=>{
    assert.match(css,/#exercisePickerDialog\s*\{[^}]*overflow:\s*hidden/);
  });
  it('lays the dialog out as a column with the results list absorbing all flex',()=>{
    assert.match(css,/#exercisePickerDialog \.custom-form\s*\{[^}]*flex-direction:\s*column/);
    assert.match(css,/#exercisePickerDialog \.picker-list\s*\{[^}]*flex:\s*1 1 auto[^}]*min-height:\s*0[^}]*max-height:\s*none/);
  });
});
