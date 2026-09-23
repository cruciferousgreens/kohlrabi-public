'use strict';
/* Test harness: loads app sources into this process's global scope — the same
   shared-global model as the app's classic <script> tags — with stubbed
   browser globals. Zero dependencies.

   Usage in a *.test.js file:
     const {loadRole}=require('./harness');
     const {topSetForSession, progressionForExercise, workoutState}=loadRole('progression-logic');
     // or with injected globals: loadRole('csv-import',{globals:{exercises:fixtureCatalog}})

   G2 (no load-time exceptions) is enforced here: a source file that throws
   at evaluation fails the load with a tagged error, which fails the test
   file's process. Each test file runs in its own process under
   `node --test`, so global state never leaks between files. */
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const REPO_ROOT=path.resolve(__dirname,'..');
const MODULE_MAP=require('./module-map');
const {makeStubs}=require('./stubs');

function loadRole(role,opts={}){
  const entry=MODULE_MAP[role];
  if(!entry)throw new Error(`unknown test role: ${role}`);
  // v1.878: each source file evaluates once per process, like the app's
  // <script> tags. Roles overlap (formulas ride along everywhere); without
  // the guard, a file calling loadRole twice re-declared top-level consts
  // and died with "Identifier ... has already been declared". Re-running a
  // const/let file can never have worked, and re-running function-only
  // files is a no-op — skipping is strictly the sane behavior.
  if(!globalThis.__hatchLoadedFiles)globalThis.__hatchLoadedFiles=new Set();
  const loaded=globalThis.__hatchLoadedFiles;
  // Browser stubs BEFORE sources evaluate. Assign defensively: the host may
  // already own a name (e.g. Node's global navigator is getter-only).
  for(const [k,v] of Object.entries(makeStubs())){
    try{globalThis[k]=v;}catch(_){/* host-owned global; leave it */}
  }
  for(const rel of entry.files){
    if(loaded.has(rel))continue;
    const code=fs.readFileSync(path.join(REPO_ROOT,rel),'utf8');
    try{
      vm.runInThisContext(code,{filename:rel});
      loaded.add(rel);
    }catch(err){
      const e=new Error(`[G2] ${rel} threw at load: ${err&&err.message}`);
      e.cause=err;
      throw e;
    }
  }
  if(entry.inject)vm.runInThisContext(entry.inject,{filename:`<${role} inject>`});
  if(opts.globals)Object.assign(globalThis,opts.globals);
  /* #539: the app guarantees catalog.js loads before every consumer
     (index.html script order), so resolveExercise/canonicalExerciseId are
     always present at runtime. Test roles that inject a fixture `exercises`
     catalog bypass catalog.js — give them the identical fallback so those
     roles exercise the same resolution semantics. Skipped when the role
     loaded the real catalog.js. */
  vm.runInThisContext(`if(typeof resolveExercise==='undefined'){
    let _exerciseMapCache=null;
    function _exerciseMap(){
      /* #548: the old identity/length caching missed in-place catalog edits
         (tests push/pop entries after load; lengths repeat). Test-only, so
         just rebuild every call — catalogs are tiny here. */
      _exerciseMapCache=new Map();
      if(Array.isArray(exercises))for(const x of exercises)if(x&&x.id!=null&&!_exerciseMapCache.has(x.id))_exerciseMapCache.set(x.id,x);
      return _exerciseMapCache;
    }
    function canonicalExerciseId(id){
      if(!id||typeof exercises==='undefined'||!Array.isArray(exercises))return id;
      let cur=_exerciseMap().get(id);
      const seen=new Set();
      while(cur&&cur.aliasOf&&!seen.has(cur.id)){
        seen.add(cur.id);
        cur=_exerciseMap().get(cur.aliasOf);
      }
      return cur?cur.id:id;
    }
    function resolveExercise(id){
      if(typeof exercises==='undefined'||!Array.isArray(exercises))return undefined;
      return _exerciseMap().get(canonicalExerciseId(id));
    }
  }`,{filename:'<alias-539 fallback>'});
  /* Return a resolver, not globalThis: sources declare top-level const/let
     (workoutState, progressionSetup, …) which live in the global LEXICAL
     environment — visible as bare identifiers but NOT as globalThis
     properties. Indirect eval resolves them the way the app's later
     <script> tags do. */
  const indirectEval=eval;
  return new Proxy(Object.create(null),{
    get:(_,name)=>{
      if(typeof name!=='string')return undefined;
      return indirectEval(name);
    },
    has:(_,name)=>{try{indirectEval(`typeof ${String(name)}`);return true;}catch(_){return false;}},
  });
}

module.exports={loadRole,REPO_ROOT,MODULE_MAP};
