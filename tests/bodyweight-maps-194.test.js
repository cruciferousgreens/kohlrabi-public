'use strict';
/* #194: bodyweight work lights the anatomical muscle map — end to end through
   the real hydrateBodyMaps(). The real Sasha SVG template rides in via a
   stubbed fetch; a minimal fake-DOM host carries the data-volumes /
   data-worked attributes exactly as muscleHeatmapMarkup() renders them, and
   SVG regions are parsed out of the template text. This pins the mechanism
   the user saw broken: zero-volume (bodyweight) regions must get the flat
   heat-worked highlight instead of staying dark, without disturbing the
   weight-based heat ranking. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');
const catalog=require('./fixtures/catalog');

const {
  muscleVolumes, muscleHeatmapMarkup, workedMuscles, hydrateBodyMaps,
}=loadRole('stats-math',{globals:{exercises:catalog}});

/* --- minimal fake DOM: just what hydrateBodyMaps()'s volume branch needs --- */
function makeRegion(muscle){
  const added=[];
  return {
    dataset:{muscle},
    classList:{add:(c)=>{added.push(c);},classes:added},
    prepend(){},
  };
}
function makeHost({volumesAttr,workedAttr}){
  const regions=new Map(); // data-muscle value -> [region,...]
  const host={
    dataset:{volumes:volumesAttr,worked:workedAttr},
    _hydrated:false,
    setAttribute(k){if(k==='data-hydrated')host._hydrated=true;},
    querySelectorAll(sel){
      if(sel==='[data-muscle]')return [...regions.values()].flat();
      if(sel==='svg')return [];
      return [];
    },
    set innerHTML(svgText){
      const re=/data-muscle="([^"]+)"/g;
      let m;
      while((m=re.exec(svgText))){
        const muscle=m[1];
        if(!regions.has(muscle))regions.set(muscle,[]);
        regions.get(muscle).push(makeRegion(muscle));
      }
    },
    _regions:regions,
  };
  return host;
}
let host=null;
const svgText=fs.readFileSync(path.join(__dirname,'..','data','sasha-male-body.svg'),'utf8');
globalThis.fetch=async()=>({ok:true,text:async()=>svgText});
globalThis.document={
  createElement:()=>{
    let _text='';
    return {
      set textContent(v){_text=String(v);},
      get innerHTML(){return _text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');},
    };
  },
  querySelectorAll(sel){
    if(sel==='.anatomy-map[data-volumes]:not([data-hydrated])')return (host&&!host._hydrated)?[host]:[];
    if(sel==='.anatomy-map[data-primary]:not([data-hydrated])')return [];
    if(sel==='.anatomy-map[data-worked]:not([data-hydrated])')return [];
    return [];
  },
  createElementNS:()=>({set textContent(_v){},prepend(){}}),
};

function attrsFromMarkup(html){
  return {
    volumesAttr:html.match(/data-volumes="([^"]*)"/)[1],
    workedAttr:html.match(/data-worked="([^"]*)"/)[1],
  };
}
function W(id,items){
  return {id,date:'2026-09-11',isoDate:'2026-09-11',name:'W '+id,
    exercises:items.map(([exId,sets])=>({exerciseId:exId,sets}))};
}
function S(w,r){return {w,r,seconds:null,rpe:null,tags:[]};}
function regionClasses(muscle){
  return (host._regions.get(muscle)||[]).flatMap(r=>r.classList.classes);
}
function hasHeat(muscle){return regionClasses(muscle).some(c=>c==='heat-worked'||/^heat-[1-5]$/.test(c));}

describe('#194 bodyweight sets light the anatomical map (hydrateBodyMaps)',()=>{
  it('bodyweight-only session: worked regions get heat-worked, unworked stay dark',async()=>{
    const workouts=[W('bw',[
      ['deadlift',[S(0,10),S(0,8)]],   // w=0: bodyweight-style sets
    ])];
    const html=muscleHeatmapMarkup(muscleVolumes(workouts),workedMuscles(workouts),true);
    host=makeHost(attrsFromMarkup(html));
    await hydrateBodyMaps();
    assert.ok(regionClasses('hamstrings').includes('heat-worked'),'hamstrings lit flat');
    assert.ok(regionClasses('glutes').includes('heat-worked'),'glutes lit flat');
    assert.ok(!hasHeat('biceps'),'biceps stays dark');
    assert.ok(!hasHeat('calves'),'calves stays dark');
  });
  it('alias proxy: adductors (no dedicated SVG region) light the quads region',async()=>{
    const html=muscleHeatmapMarkup({},new Set(['adductors']),true);
    host=makeHost(attrsFromMarkup(html));
    await hydrateBodyMaps();
    assert.ok(regionClasses('quads').includes('heat-worked'),'quads proxy lit for adductors');
    assert.ok(!hasHeat('biceps'),'biceps stays dark');
  });
  it('mixed session: weighted regions keep their heat rank, bodyweight regions go flat',async()=>{
    const workouts=[W('mix',[
      ['bench-press',[S(100,8),S(100,8)]], // 1600 lb: chest is the max
      ['deadlift',[S(0,10)]],              // bodyweight hamstrings
    ])];
    const html=muscleHeatmapMarkup(muscleVolumes(workouts),workedMuscles(workouts),true);
    host=makeHost(attrsFromMarkup(html));
    await hydrateBodyMaps();
    const chest=regionClasses('upper-chest');
    assert.ok(chest.includes('heat-5'),'max-volume region gets top heat rank');
    assert.ok(!chest.includes('heat-worked'),'weighted region is ranked, not flat');
    assert.ok(regionClasses('hamstrings').includes('heat-worked'),'bodyweight hamstrings lit flat');
  });
});
