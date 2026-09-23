
/* ===== module: storage.js ===== */
/** IndexedDB key/value adapter + cyrb53 hashing.
    Post-v1 storage (user 2026-09-13, one build): the big persist blob lives in
    IndexedDB — async (writes leave the main thread), device-dependent quota
    (hundreds of MB vs localStorage's ~5 MB on iOS Safari), and real error
    events instead of silent quota death. localStorage keeps the tiny
    synchronous keys (theme, cross-tab signal) and remains the full fallback
    when IndexedDB is unavailable — the app then behaves exactly as before.
    Depends on: nothing. Used by: persistence.js (blob load/save/migration,
    cyrb53 for dirty-detection hashing). */
/* cyrb53: fast non-crypto 53-bit hash for dirty-detection. A collision only
   delays a persist until the next change — never a correctness issue. */
function cyrb53(str,seed){
  seed=seed||0;
  let h1=0xdeadbeef^seed,h2=0x41c6ce57^seed;
  for(let i=0,ch;i<str.length;i++){
    ch=str.charCodeAt(i);
    h1=Math.imul(h1^ch,2654435761);
    h2=Math.imul(h2^ch,1597334677);
  }
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (h2>>>0).toString(36)+(h1>>>0).toString(36);
}
const IDB_DB_NAME='workout-app';
const IDB_STORE_NAME='kv';
let _idbDbPromise=null;
/* Opens the DB once; resolves null when IndexedDB is missing, blocked, or
   wedged (3s cap so boot never hangs on a broken IDB). */
function _openIdb(){
  if(_idbDbPromise)return _idbDbPromise;
  _idbDbPromise=new Promise(function(resolve){
    let settled=false;
    const done=function(v){if(!settled){settled=true;resolve(v);}};
    setTimeout(function(){done(null);},3000);
    let req;
    try{
      if(typeof indexedDB==='undefined'){done(null);return;}
      req=indexedDB.open(IDB_DB_NAME,1);
    }catch(_){done(null);return;}
    req.onupgradeneeded=function(){try{req.result.createObjectStore(IDB_STORE_NAME);}catch(_){}};
    req.onsuccess=function(){let db=null;try{db=req.result;}catch(_){}done(db);};
    req.onerror=function(){done(null);};
    req.onblocked=function(){done(null);};
  });
  return _idbDbPromise;
}
/* Raw IDB get: undefined = IDB unavailable, null = key missing. */
function _idbGet(key){
  return _openIdb().then(function(db){
    if(!db)return undefined;
    return new Promise(function(resolve){
      let req;
      try{req=db.transaction(IDB_STORE_NAME,'readonly').objectStore(IDB_STORE_NAME).get(key);}
      catch(_){resolve(undefined);return;}
      req.onsuccess=function(){let v;try{v=req.result;}catch(_){resolve(undefined);return;}resolve(v===undefined?null:v);};
      req.onerror=function(){resolve(undefined);};
    });
  });
}
/* Raw IDB set: false when unavailable or the write failed. Resolves only when
   the TRANSACTION commits — never on request success (#520: a request can
   report success while the page tears down before commit, losing the write
   or leaving a delete uncommitted so boot resurrects the "deleted" blob). */
function _idbSet(key,value){
  return _openIdb().then(function(db){
    if(!db)return false;
    return new Promise(function(resolve){
      let tx;
      try{
        tx=db.transaction(IDB_STORE_NAME,'readwrite');
        tx.objectStore(IDB_STORE_NAME).put(value,key);
      }catch(_){resolve(false);return;}
      tx.oncomplete=function(){resolve(true);};
      tx.onerror=function(){resolve(false);};
      tx.onabort=function(){resolve(false);};
    });
  });
}
/* Raw IDB delete: same commit-gated durability as _idbSet (#520). */
function _idbDel(key){
  return _openIdb().then(function(db){
    if(!db)return false;
    return new Promise(function(resolve){
      let tx;
      try{
        tx=db.transaction(IDB_STORE_NAME,'readwrite');
        tx.objectStore(IDB_STORE_NAME).delete(key);
      }catch(_){resolve(false);return;}
      tx.oncomplete=function(){resolve(true);};
      tx.onerror=function(){resolve(false);};
      tx.onabort=function(){resolve(false);};
    });
  });
}
const Storage={
  backend:null, /* 'idb' | 'localStorage', decided by probe() */
  /* Probe once: IDB must open AND round-trip a probe value. Anything less
     and the whole session runs on localStorage, exactly as before. */
  async probe(){
    if(this.backend)return this.backend;
    try{
      const w=await _idbSet('__probe','1');
      if(w){
        const back=await _idbGet('__probe');
        await _idbDel('__probe');
        if(back==='1'){this.backend='idb';return 'idb';}
      }
    }catch(_){}
    this.backend='localStorage';
    return 'localStorage';
  },
  /* Raw IDB access for the migration (no LS fallback — the migration must
     know which store answered). */
  idbGet(key){return _idbGet(key);},
  idbSet(key,value){return _idbSet(key,value);},
  idbDel(key){return _idbDel(key);},
  async loadBlob(key){
    if(await this.probe()==='idb'){
      const v=await this.idbGet(key);
      if(v!==undefined)return v;
    }
    try{return localStorage.getItem(key);}catch(_){return null;}
  },
  /* Returns true on a durable write. An IDB write failure is reported (not
     silently rerouted to LS) so the A4 "couldn't save" surfacing fires and
     no split-brain copy exists. */
  async saveBlob(key,str){
    const s=String(str);
    if(await this.probe()==='idb'){
      if(await this.idbSet(key,s))return true;
      return false;
    }
    try{localStorage.setItem(key,s);return true;}catch(_){return false;}
  },
  async deleteBlob(key){
    if(await this.probe()==='idb')await this.idbDel(key);
    try{localStorage.removeItem(key);}catch(_){}
  },
  /* Durable delete with verification (#520): delete, read back, and retry
     once if the blob is still there. Returns true only when the key is
     verified gone from IndexedDB. Never trusts the memoized probe: a
     session that fell back to localStorage can still hold a live blob in
     IndexedDB (the probe is per-session — it can fail here and succeed on
     the next boot, which then resurrects the "deleted" blob). An
     unreachable IDB (get resolves undefined) is "unverified", never
     success — the caller falls back to the localStorage trump card. */
  async deleteBlobDurable(key){
    for(let attempt=0;attempt<2;attempt++){
      try{await this.idbDel(key);}catch(_){/* unreachable — verify below */}
      let still='unknown';
      try{still=await this.idbGet(key);}catch(_){still='unknown';}
      if(still===null)return true; /* verified gone */
      /* undefined/'unknown': IDB unreachable — cannot verify, stop retrying
         (the open promise is memoized; a retry can't help). */
      if(still===undefined||still==='unknown')return false;
      /* Blob survived the delete — the loop retries once. */
    }
    return false;
  },
};
