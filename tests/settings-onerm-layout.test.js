'use strict';
/* #206 (user 2026-09-12): the %1RM progression-default settings block rendered
   garbled — the notched-label rule (`.rule-field > span { position:absolute }`)
   caught every direct-child span, so the `.prog-onerm-input` wrapper and the
   `.field-help` spans were yanked up into the label's notch position, floating
   inputs over truncated labels ("LT", "TY DEFAULT", "0 = NO SCHEDULED
   DELOADS."). The rows now use the standard label-span + input + em.unit
   pattern (like "Increment value"), and the notch selector only targets the
   label span. Layout-only: ids, values, and wiring are untouched.
   QA batch (user 2026-09-22): Auto Deload removed entirely — the deload
   defaults ("Deload every N weeks" / "Deload intensity") are gone with it. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');
const bootstrap=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');
const programs=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');

/* Every .rule-field's inner markup: exactly one direct-child span (the label). */
function ruleFieldInners(){
  const out=[];
  const re=/(<(?:label|div)\b[^>]*class="rule-field"[^>]*>)/g;
  let m;
  while((m=re.exec(html))){
    const tag=m[1];
    const close=tag.startsWith('<label')?'</label>':'</div>';
    const end=html.indexOf(close,m.index+tag.length);
    out.push({tag,inner:html.slice(m.index+tag.length,end)});
  }
  return out;
}

describe('%1RM settings rows use the standard label + input + unit pattern',()=>{
  it('full label texts are present and readable',()=>{
    assert.ok(html.includes('<span>% of 1RM default</span>'),'label "% of 1RM default" present');
    assert.ok(!html.includes('<span>Deload every N weeks</span>'),'Auto Deload labels are gone');
  });
  it('no input-wrapper or help spans remain inside a .rule-field',()=>{
    for(const {tag,inner} of ruleFieldInners()){
      assert.ok(!inner.includes('prog-onerm-input'),`no input wrapper in ${tag.slice(0,60)}`);
      assert.ok(!inner.includes('field-help'),`no help span in ${tag.slice(0,60)}`);
    }
  });
  it('each .rule-field has exactly one span: the label',()=>{
    for(const {tag,inner} of ruleFieldInners()){
      const spans=(inner.match(/<span\b/g)||[]).length;
      assert.strictEqual(spans,1,`one label span in ${tag.slice(0,60)}`);
    }
  });
  it('settings inputs keep their ids, rows keep their ids',()=>{
    for(const id of ['settingsPercentOf1RM','settingsPctRow']){
      assert.ok(html.includes(`id="${id}"`),`#${id} present`);
    }
    for(const id of ['settingsDeloadEvery','settingsDeloadPct','settingsAutoDeloadToggle','settingsAutoDeloadPanel']){
      assert.ok(!html.includes(`id="${id}"`),`#${id} removed with Auto Deload`);
    }
  });
  it('settings wiring is intact: values painted and input listeners persist',()=>{
    assert.ok(bootstrap.includes("$('#settingsPercentOf1RM')"),'app-bootstrap references #settingsPercentOf1RM');
    assert.ok(bootstrap.includes("$('#settingsPctRow')"),'visibility toggle for #settingsPctRow intact');
    assert.ok(!bootstrap.includes("$('#settingsAutoDeloadToggle')"),'Auto Deload toggle wiring is gone');
  });
});

describe('notch selector only targets the label span (#206 root cause)',()=>{
  it('.rule-field > span:first-child carries the absolute notch',()=>{
    assert.match(css,/\.rule-field > span:first-child\s*\{[^}]*position:\s*absolute/,
      'notch rule scoped to the first (label) span');
  });
  it('no bare .rule-field > span absolute rule remains',()=>{
    const cssNoComments=css.replace(/\/\*[\s\S]*?\*\//g,'');
    const bare=(cssNoComments.match(/\.rule-field > span\s*\{/g)||[]).length;
    assert.strictEqual(bare,0,'bare .rule-field > span rule is gone');
  });
});

describe('program-builder %1RM rows share the same fix',()=>{
  it('full label texts are present',()=>{
    assert.ok(html.includes('<span>% of 1RM</span>'),'label "% of 1RM" present');
  });
  it('program inputs and rows keep their ids',()=>{
    for(const id of ['progressionPercentOf1RM','progressionPctRow']){
      assert.ok(html.includes(`id="${id}"`),`#${id} present`);
    }
    for(const id of ['deloadEvery','deloadPct','autoDeloadToggle','autoDeloadPanel']){
      assert.ok(!html.includes(`id="${id}"`),`#${id} removed with Auto Deload`);
    }
  });
  it('program wiring still references the inputs',()=>{
    assert.ok(bootstrap.includes("$('#progressionPercentOf1RM')"),'input listener intact');
  });
});
