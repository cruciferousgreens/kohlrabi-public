'use strict';
/* Rest-day feature removal (user 2026-09-22): the rest-day feature is gone.
   No rest-day UI, no progression skipping, no persisted/synced rest-day
   state. The only intentional survivor is the legacy `restDays` backup key
   in csv-import.js (old backups still validate; the key is shape-checked
   but ignored on restore). These regressions pin the removal. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const src=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');
const html=src('index.html');
const css=src('assets/styles.css');
const progression=src('assets/js/workout/progression.js');
const dashboard=src('assets/js/pages/dashboard-stats.js');
const stateJs=src('assets/js/core/state.js');
const persistence=src('assets/js/core/persistence.js');
const csvImport=src('assets/js/core/csv-import.js');

/* All JS except the intentional legacy backup path. */
function appJs(){
  const files=[];
  const walk=(dir)=>{
    for(const e of fs.readdirSync(dir,{withFileTypes:true})){
      const p=path.join(dir,e.name);
      if(e.isDirectory())walk(p);
      else if(e.name.endsWith('.js')&&!p.includes('csv-import.js'))files.push(p);
    }
  };
  walk(path.join(ROOT,'assets','js'));
  return files.map(p=>({file:path.relative(ROOT,p),code:fs.readFileSync(p,'utf8')}));
}

describe('rest-day removal: no UI text or controls',()=>{
  it('index.html has no rest-day copy',()=>{
    assert.ok(!/rest-day/i.test(html),'no "rest-day" in markup');
    assert.ok(!/rest day/i.test(html),'no "rest day" in copy');
  });
  it('styles.css has no rest-day rules',()=>{
    assert.ok(!/rest-day/i.test(css),'no rest-day selectors');
  });
  it('no app JS renders rest-day UI (csv-import legacy key excluded)',()=>{
    for(const {file,code} of appJs()){
      assert.ok(!/rest-day/i.test(code),`${file}: no rest-day UI strings`);
      assert.ok(!/\brestDay\b/.test(code),`${file}: no restDay identifiers`);
    }
  });
  it('state.js carries no rest-day state',()=>{
    assert.ok(!/\brestDays\b/.test(stateJs),'no state.restDays');
  });
  it('persistence.js does not persist or sync rest days',()=>{
    assert.ok(!/\brestDays\b/.test(persistence),'no restDays in persistence');
  });
});

describe('rest-day removal: progression uses the latest ordinary log',()=>{
  it('progression.js does not filter logs by rest days',()=>{
    assert.ok(!/\brestDays?\b/i.test(progression),'no rest-day filtering in progression');
  });
  it('the legacy restDays backup key is explicitly ignored on restore',()=>{
    assert.ok(csvImport.includes('restDays'),'legacy key still accepted');
    assert.ok(/legacy/i.test(csvImport),'marked as legacy');
  });
});

describe('rest-day removal: future Upcoming cards always retain Start',()=>{
  it('upcomingProgramMarkup always renders the Start button when a workout is suggested',()=>{
    const fnStart=dashboard.indexOf('function upcomingProgramMarkup(');
    assert.ok(fnStart>-1,'upcomingProgramMarkup defined');
    const fnEnd=dashboard.indexOf('\n    }',fnStart);
    const fn=dashboard.slice(fnStart,fnEnd);
    assert.ok(fn.includes('startUpcomingProgramWorkout'),'Start button rendered');
    assert.ok(!/rest/i.test(fn),'no rest-day condition on the Start button');
  });
});
