'use strict';
/* #438 (user 2026-09-14): superset group outline. Consecutive exercises sharing
   a supersetId render inside one subtle group outline (one "Superset N" label +
   one Edit superset affordance) instead of a per-card band. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');

function loadSupersetHelpers(){
  const sandbox={window:{},document:{},localStorage:{getItem:()=>null,setItem(){}}};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT,'assets/js/lib/utilities.js'),'utf8'),sandbox,{filename:'utilities.js'});
  vm.runInContext(fs.readFileSync(path.join(ROOT,'assets/js/workout/supersets.js'),'utf8'),sandbox,{filename:'supersets.js'});
  return sandbox;
}

const item=(uid,supersetId)=>({uid,exerciseId:'ex-'+uid,supersetId:supersetId||null});
/* vm-realm objects fail assert/strict deepEqual against host-realm literals
   ("same structure but not reference-equal"), so round-trip through JSON. */
const blocksOf=(s,list)=>JSON.parse(JSON.stringify(s.supersetVisualBlocks(list)));

describe('#438 supersetVisualBlocks',()=>{
  it('wraps consecutive same-supersetId members in one group block',()=>{
    const s=loadSupersetHelpers();
    const list=[item('a'),item('b','g1'),item('c','g1'),item('d')];
    const blocks=blocksOf(s,list);
    assert.equal(blocks.length,3);
    assert.equal(blocks[0].group,false);
    assert.equal(blocks[0].items[0].uid,'a');
    assert.equal(blocks[1].group,true);
    assert.equal(blocks[1].supersetId,'g1');
    assert.deepEqual(blocks[1].items.map(x=>x.uid),['b','c']);
    assert.equal(blocks[2].group,false);
    assert.equal(blocks[2].items[0].uid,'d');
  });
  it('a singleton supersetId is a single block, not a group',()=>{
    const s=loadSupersetHelpers();
    const blocks=blocksOf(s,[item('a','g1'),item('b')]);
    assert.equal(blocks.length,2);
    assert.ok(blocks.every(b=>!b.group));
  });
  it('two groups stay separate blocks in list order',()=>{
    const s=loadSupersetHelpers();
    const list=[item('a','g1'),item('b','g1'),item('c'),item('d','g2'),item('e','g2')];
    const blocks=blocksOf(s,list);
    assert.deepEqual(blocks.map(b=>b.group),[true,false,true]);
    assert.deepEqual(blocks[0].items.map(x=>x.uid),['a','b']);
    assert.deepEqual(blocks[2].items.map(x=>x.uid),['d','e']);
  });
  it('non-adjacent members of one group get one outline each, same group number',()=>{
    const s=loadSupersetHelpers();
    const list=[item('a','g1'),item('b'),item('c','g1')];
    const blocks=blocksOf(s,list);
    assert.deepEqual(blocks.map(b=>b.group),[true,false,true]);
    assert.equal(blocks[0].supersetId,'g1');
    assert.equal(blocks[2].supersetId,'g1');
    assert.equal(s.supersetGroupNumber(list,'g1'),1);
  });
  it('empty list yields no blocks',()=>{
    const s=loadSupersetHelpers();
    assert.equal(s.supersetVisualBlocks([]).length,0);
  });
});

describe('#438 supersetGroupHeadHtml',()=>{
  it('renders one label and one Edit affordance with the caller data attribute',()=>{
    const s=loadSupersetHelpers();
    const list=[item('a','g1'),item('b','g1'),item('c','g2'),item('d','g2')];
    const html=s.supersetGroupHeadHtml(list,'g2','data-superset-uid="c"');
    assert.match(html,/Superset 2/);
    assert.match(html,/data-superset-uid="c"/);
    assert.equal((html.match(/Edit superset/g)||[]).length,2); // aria-label + button text
    assert.equal((html.match(/<button/g)||[]).length,1);
    assert.doesNotMatch(html,/superset-band/);
  });
});

describe('user 2026-09-14: reorder lumps a superset together (moveBlockAt)',()=>{
  it('moving a group member moves the whole block',()=>{
    const s=loadSupersetHelpers();
    const list=[item('a','g1'),item('b','g1'),item('c'),item('d')];
    const moved=JSON.parse(JSON.stringify(s.moveBlockAt(list,0,'down')));
    assert.deepEqual(moved.map(x=>x.uid),['c','a','b','d']);
  });
  it('moving a singleton still moves just one row',()=>{
    const s=loadSupersetHelpers();
    const list=[item('a','g1'),item('b','g1'),item('c'),item('d')];
    const moved=JSON.parse(JSON.stringify(s.moveBlockAt(list,2,'down')));
    assert.deepEqual(moved.map(x=>x.uid),['a','b','d','c']);
  });
  it('cannot move the first block up or the last block down',()=>{
    const s=loadSupersetHelpers();
    const list=[item('a','g1'),item('b','g1'),item('c')];
    assert.equal(s.moveBlockAt(list,0,'up'),null);
    assert.equal(s.moveBlockAt(list,2,'down'),null);
  });
  it('a split group never merges from a move — blocks stay intact',()=>{
    const s=loadSupersetHelpers();
    const list=[item('a','g1'),item('b'),item('c','g1')];
    const moved=JSON.parse(JSON.stringify(s.moveBlockAt(list,2,'up')));
    assert.deepEqual(moved.map(x=>x.uid),['a','c','b']);
  });
});

describe('user 2026-09-14: subtler superset wrapper',()=>{
  it('wrapper box is tight with a muted label',()=>{
    const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');
    const rule=css.match(/\.superset-group\s*\{[^}]*\}/)[0];
    assert.match(rule,/gap:\s*6px/);
    assert.match(rule,/padding:\s*8px/);
    const label=css.match(/\.superset-group-label\s*\{[^}]*\}/)[0];
    assert.match(label,/color:\s*var\(--muted\)/);
  });
  /* User 2026-09-22: the per-exercise member picker is gone — superset
     management lives in the reorder dialog's checkboxes. The two tests that
     covered the picker's toggle re-render and refocus behavior were removed
     with it. */
});
