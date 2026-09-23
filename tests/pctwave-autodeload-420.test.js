'use strict';
/* #420 follow-ups (user 2026-09-13): the wave section sits directly below the
   "Vary % of 1RM by week" Settings toggle.
   QA batch (user 2026-09-22): Auto Deload removed entirely — the #420
   Auto-Deload gating tests were deleted with it. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');

describe('#420 wave placement',()=>{
  it('the wave section sits directly below the wave toggle',()=>{
    const waveToggle=html.indexOf('id="settingsPctWaveDefaultToggle"');
    const waveWrap=html.indexOf('id="settingsPctWaveWrap"');
    assert.ok(waveToggle>=0,'wave toggle exists');
    assert.ok(waveWrap>waveToggle,'wave section follows the wave toggle');
  });
  it('no Auto Deload markup remains in Settings',()=>{
    assert.ok(html.indexOf('id="settingsAutoDeloadToggle"')===-1,'settings Auto Deload toggle gone');
    assert.ok(html.indexOf('id="settingsAutoDeloadPanel"')===-1,'settings Auto Deload panel gone');
  });
});
