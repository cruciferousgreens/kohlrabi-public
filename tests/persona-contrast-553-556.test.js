'use strict';
/* #553–#556 (persona sweep v1.862): contrast fixes. Destructive buttons and
   the saved-filter count badge must use the on-accent token (white-on-red
   was unreadable in dark themes), the light-theme --warning must meet WCAG
   AA, and the onboarding selected checkmark must use on-accent. Pinned at
   the source level so a token drift can't silently regress them. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const css=fs.readFileSync(path.join(__dirname,'..','assets','styles.css'),'utf8');

describe('#553–#556: contrast tokens',()=>{
  it('#553 destructive buttons use --on-accent',()=>{
    assert.ok(css.includes('.primary-button.danger-button { border-color: var(--danger); background: var(--danger); color: var(--on-accent); }'),
      'danger buttons must render text in the on-accent token');
    assert.ok(css.includes('.form-action.danger { border: 0; background: var(--danger); color: var(--on-accent); }'),
      'danger form actions must render text in the on-accent token');
  });
  it('#554 the saved-filter count badge uses --on-accent',()=>{
    const m=css.match(/\.saved-filter-btn \.filter-count \{[^}]*\}/);
    assert.ok(m,'filter-count rule must exist');
    assert.ok(m[0].includes('color: var(--on-accent)'),'badge text must use the on-accent token');
  });
  it('#555 light-theme --warning is darkened to #9a5515',()=>{
    /* The light theme block is the first :root-ish theme declaration; assert
       the value directly rather than parsing theme scoping. */
    assert.ok(css.includes('--warning: #9a5515;'),'light --warning must be #9a5515 (AA on light bg)');
    assert.ok(!css.includes('--warning: #b86b20;'),'the old failing value must be gone');
  });
  it('#556 the onboarding selected checkmark uses --on-accent',()=>{
    const m=css.match(/\.of-optrow\.of-sel \.of-check::after\{[^}]*\}/);
    assert.ok(m,'selected checkmark rule must exist');
    assert.ok(m[0].includes('border:solid var(--on-accent)'),'checkmark must use the on-accent token');
  });
});
