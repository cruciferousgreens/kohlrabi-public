'use strict';
/* #502/#408 (user 2026-09-16): Settings sections expand INDEPENDENTLY —
   opening one never closes the others, and each section's expansion state
   persists per section key (state.settingsSections, sparse {key:true}),
   persisted locally via PERSISTED_KEYS.
   Entering the Settings tab restores the saved state instead of resetting
   to all-collapsed. #502 pins the grouping — the 7 sections (Appearance,
   Display, Units, Exercise defaults, Progression, Data, About) in that
   order, every pre-existing control id preserved.
   (The Exercise detail section for #3 was removed 2026-09-16; Warm-up was
   merged into Exercise defaults and Units split into Display+Units by the
   PP1 pixel-peeper reorganization, 2026-09-22.) PP1 B5 (2026-09-22): Account
   is a collapsible <details> like the rest (no longer an always-open div),
   but signed-out users always get it collapsed. Marketing
   (privacy/subscription prefs, moved out of Data) is a collapsed-by-default
   card after Data. No functionality changes. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const src=(p)=>fs.readFileSync(path.join(ROOT,p),'utf8');
const html=src('index.html');
const bootstrap=src('assets/js/core/app-bootstrap.js');
const navigation=src('assets/js/core/navigation.js');
const stateJs=src('assets/js/core/state.js');
const persistence=src('assets/js/core/persistence.js');

const sv=html.slice(html.indexOf('<section id="settingsView"'),html.indexOf('<article id="detailView"'));

/* Extract one top-level `function name(...) { ... }` with a balanced-brace scan. */
function extractFunction(source,name){
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,`function ${name} defined`);
  const open=source.indexOf('{',start);
  let depth=0;
  for(let i=open;i<source.length;i++){
    if(source[i]==='{')depth++;
    else if(source[i]==='}'){depth--;if(depth===0)return source.slice(start,i+1);}
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/* Split the settings view into its top-level <details> cards (balanced tags). */
function settingsCards(){
  const cards=[];
  let pos=0;
  while(true){
    const o=sv.indexOf('<details',pos);
    if(o===-1)break;
    let depth=0,i=o;
    while(true){
      const no=sv.indexOf('<details',i),nc=sv.indexOf('</details>',i);
      if(nc===-1)throw new Error('unclosed details');
      if(no!==-1&&no<nc){depth++;i=no+1;}
      else{depth--;i=nc+10;if(depth===0){cards.push(sv.slice(o,i));pos=i;break;}}
    }
  }
  return cards;
}

describe('#502 Settings accordion keeps the pinned grouping',()=>{
  it('the sections read in the pinned order (public fork: Account/Marketing removed)',()=>{
    const heads=[...sv.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map(m=>m[1]);
    assert.deepEqual(heads,
      ['Appearance','Display','Units','Exercise defaults','Progression','Data','About'],
      'section order reflects the PP1 reorganization minus Account/Marketing');
  });
  it('no Account or Marketing cards exist (public fork: no accounts/email)',()=>{
    const cards=settingsCards();
    assert.equal(cards.length,7,'7 accordion details cards');
    assert.ok(!sv.includes('<section class="dashboard-card'),'no plain section cards left');
    for(const c of cards)assert.ok(c.includes('settings-section'),'card carries settings-section');
    assert.ok(!/data-section="account"/.test(sv),'account card gone');
    assert.ok(!/data-section="marketing"/.test(sv),'marketing card gone');
    assert.ok(!sv.includes('account-card'),'compact account card class gone');
  });
  it('each card keeps its identity classes/ids',()=>{
    assert.ok(sv.includes('id="progressionDefaultsCard"'),'progression card id kept');
    assert.ok(sv.includes('id="defaultsCard"'),'defaults card id kept');
    /* user 2026-09-16: the corner info button was removed from the Settings
       progression card (the program-setup one keeps its own). */
    assert.ok(!sv.includes('id="progressionInfoButton"'),'settings progression info button removed');
  });
  it('Data section carries no delete-account button (public fork: no accounts)',()=>{
    const dataStart=sv.indexOf('data-section="data"');
    const aboutStart=sv.indexOf('data-section="about"');
    assert.ok(dataStart>0&&aboutStart>dataStart,'data/about sections found');
    const dataCard=sv.slice(dataStart,aboutStart);
    assert.ok(!dataCard.includes('settingsDeleteAccountButton'),'delete-account button still present');
  });
  it('every card carries a stable data-section key',()=>{
    const keys=[...sv.matchAll(/<(?:details|div)[^>]*data-section="([^"]+)"/g)].map(m=>m[1]);
    assert.deepEqual(keys,
      ['appearance','display','units','defaults','progression','data','about'],
      'stable keys in pinned order');
  });
});

describe('#408 sections start collapsed',()=>{
  it('no settings section carries the open attribute',()=>{
    assert.ok(!/<details[^>]*\bopen\b/.test(sv),'all collapsed in markup');
  });
});

describe('#408 independent expand/collapse wiring',()=>{
  it('wireSettingsAccordion persists toggles and never closes other sections',()=>{
    const fn=extractFunction(bootstrap,'wireSettingsAccordion');
    assert.ok(fn.includes("addEventListener('toggle'"),'listens for toggle');
    assert.ok(!fn.includes('other.open=false'),'no close-the-others behavior');
    assert.ok(fn.includes('settingsSections'),'persists to state.settingsSections');
    assert.ok(fn.includes('schedulePersist'),'schedules a persist on toggle');
  });
  it('showSettings restores saved section state on entry',()=>{
    assert.ok(navigation.includes('applySettingsSectionsState()'),'showSettings restores sections');
    assert.ok(!navigation.includes('collapseSettingsSections('),'old all-collapsed reset gone');
    const at=navigation.indexOf('applySettingsSectionsState()');
    const showAt=navigation.indexOf('function showSettings(');
    assert.ok(showAt!==-1&&at>showAt,'called from showSettings');
  });
  it('renderSettings does not touch section open state',()=>{
    const fn=extractFunction(bootstrap,'renderSettings');
    assert.ok(!fn.includes('collapseSettingsSections'),'no collapse inside renderSettings');
    assert.ok(!fn.includes('applySettingsSectionsState'),'no state restore inside renderSettings');
  });
});

describe('#408 expansion state persists to the account',()=>{
  it('state.js seeds settingsSections in freshNavState',()=>{
    assert.ok(/settingsSections:\{\}/.test(stateJs),'freshNavState carries settingsSections');
  });
  it('persistence.js collects and syncs settingsSections',()=>{
    assert.ok(persistence.includes("'settingsSections'"),
      'PERSISTED_KEYS includes settingsSections');
    assert.ok(/case 'settingsSections':/.test(persistence),'get/setPersistedValue handle it');
    assert.ok(/settingsSections:\{\.\.\.\(state\.settingsSections\|\|\{\}\)\}/.test(persistence),
      'collectPersistable copies it');
    assert.ok(/state\.settingsSections=\{\};/.test(persistence),'wipe resets it');
  });
});

/* Behavioral: run the real wiring against mock <details> sections. */
function mockSection(key){
  const listeners={};
  return {
    open:false,
    dataset:{section:key},
    addEventListener(ev,fn){(listeners[ev]=listeners[ev]||[]).push(fn);},
    _fire(ev){(listeners[ev]||[]).forEach(fn=>fn());},
  };
}
function loadAccordion(){
  const keys=['account','appearance','units'];
  const sections=keys.map(mockSection);
  const state={settingsSections:{}};
  let persisted=0;
  const sandbox={
    Array,Object,
    state,
    schedulePersist(){persisted++;},
    document:{
      querySelectorAll(sel){
        if(sel==='#settingsView details.settings-section')return sections;
        throw new Error('unexpected selector '+sel);
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(
    extractFunction(bootstrap,'settingsSectionKey')+';'+
    extractFunction(bootstrap,'wireSettingsAccordion')+';'+
    extractFunction(bootstrap,'applySettingsSectionsState')+';'+
    'this.__api={wireSettingsAccordion,applySettingsSectionsState,settingsSectionKey};',
    sandbox);
  return {sections,state,api:sandbox.__api,getPersisted:()=>persisted};
}

describe('#408 accordion behavior (mock sections)',()=>{
  it('opening one section does not close the others',()=>{
    const {sections,api}=loadAccordion();
    api.wireSettingsAccordion();
    sections[0].open=true;sections[0]._fire('toggle');
    sections[2].open=true;sections[2]._fire('toggle');
    assert.deepEqual(sections.map(s=>s.open),[true,false,true]);
  });
  /* Public fork: the B5 "signed-out Account stays collapsed" rule is gone
     with the Account section itself — no accounts, no sign-in state. */
  it('toggle persists the sparse expansion map',()=>{
    const {sections,state,api,getPersisted}=loadAccordion();
    api.wireSettingsAccordion();
    sections[0].open=true;sections[0]._fire('toggle');
    assert.deepEqual(state.settingsSections,{account:true});
    sections[0].open=false;sections[0]._fire('toggle');
    assert.deepEqual(state.settingsSections,{});
    assert.ok(getPersisted()>=2,'persist scheduled on each toggle');
  });
  it('applySettingsSectionsState restores the saved map',()=>{
    const {sections,state,api}=loadAccordion();
    state.settingsSections={appearance:true};
    api.applySettingsSectionsState();
    assert.deepEqual(sections.map(s=>s.open),[false,true,false]);
  });
  it('fresh profiles start all-collapsed',()=>{
    const {sections,api}=loadAccordion();
    api.applySettingsSectionsState();
    assert.deepEqual(sections.map(s=>s.open),[false,false,false]);
  });
});
