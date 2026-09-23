'use strict';
/* user 2026-09-16: Progression rules are collapsed by default during program
   creation — the section is a <details> disclosure (no `open` attribute),
   the summary keeps the "Progression rules" heading + description with a
   chevron, and every pre-existing control id (toggles, pills, inputs) still
   lives inside the disclosure body.
   user 2026-09-17: the info button moved under the expansion — it lives
   inside the disclosure body, so it only appears after expanding. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');

const section=html.slice(html.indexOf('<section class="program-progression'),html.indexOf('<!-- #419'));

describe('program creation: Progression rules collapsed by default',()=>{
  it('the rules live in a details disclosure with no open attribute',()=>{
    assert.ok(section.includes('<details class="progression-disclosure" id="programProgressionDisclosure">'),'disclosure missing');
    assert.ok(!section.includes('<details class="progression-disclosure" id="programProgressionDisclosure" open'),'disclosure is open by default');
  });
  it('the summary keeps the heading, description, and a chevron',()=>{
    const sum=section.slice(section.indexOf('<summary'),section.indexOf('</summary>'));
    assert.ok(sum.includes('id="progressionSetupTitle"'),'heading id missing from summary');
    assert.ok(sum.includes('Progression rules'),'heading text missing');
    assert.ok(sum.includes('Defaults for this program.'),'description missing');
    assert.ok(sum.includes('disclosure-chev'),'chevron missing');
  });
  it('every control still exists inside the disclosure body',()=>{
    const body=section.slice(section.indexOf('progression-disclosure-body'),section.indexOf('</details>'));
    /* QA batch 2026-09-22: the All-sets toggle is retired (per-set targets
       are the only path); Auto Deload was removed in the same batch. */
    for(const id of ['programProgressionOffToggle','programSchemePills','programRpePills','progressionIncrementType','progressionIncrementValue','programRepPresets','programRepMin','programRepMax','programTimeStepPills','programCyclePills','pctWaveToggle'])
      assert.ok(body.includes(`id="${id}"`),`control ${id} missing from disclosure body`);
    assert.ok(!body.includes('id="programAllSetsToggle"'),'retired All-sets toggle must be gone');
  });
  it('the info button lives inside the disclosure body — hidden until expansion (user 2026-09-17)',()=>{
    const btn=section.indexOf('id="programProgressionInfoButton"');
    const bodyStart=section.indexOf('progression-disclosure-body');
    const detEnd=section.indexOf('</details>');
    assert.ok(btn>=0&&bodyStart>=0&&detEnd>=0,'button/body/details missing');
    assert.ok(btn>bodyStart&&btn<detEnd,'info button is not inside the disclosure body');
    assert.ok(!section.includes('has-corner-info'),'the corner-info class is gone from the section');
    assert.ok(!section.includes('corner-info-btn'),'the corner-info button class is gone');
  });
  it('the progression-off dimming still reaches the controls through the disclosure body',()=>{
    assert.ok(css.includes('section.program-progression.progression-off .progression-disclosure-body > .settings-grid'),'dim rule for settings-grid missing');
    assert.ok(css.includes('section.program-progression.progression-off .progression-disclosure-body > .switch-row:not(#programProgressionOffRow)'),'dim rule for switch rows missing');
  });
});
