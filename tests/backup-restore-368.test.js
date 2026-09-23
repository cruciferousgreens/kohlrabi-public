/* #368 (user 2026-09-14): JSON restore — add the app's own backup format to the
   import screen with wholesale Replace semantics, strict validation before any
   mutation, and a two-step destructive confirmation. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const csvSrc = fs.readFileSync(path.join(__dirname,'..','assets','js','core','csv-import.js'),'utf8');
const indexSrc = fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

/* Extract the pure validator (plus its key-set consts) and eval it with a
   stubbed SCHEMA_VERSION — the contract under test is validation only. */
const vStart = csvSrc.indexOf('const OB_BACKUP_ARRAY_KEYS');
const vEnd = csvSrc.indexOf('\nfunction obBackupSummary');
assert.ok(vStart > 0 && vEnd > vStart, 'validator block must exist in csv-import.js');
const validatorSrc = csvSrc.slice(vStart, vEnd);
global.SCHEMA_VERSION = 1;
eval(validatorSrc);
/* obBackupSummary lives right after; eval it too for the count contract. */
const sEnd = csvSrc.indexOf('\nfunction obBackupCountLine');
eval(csvSrc.slice(vEnd, sEnd));

const goodBackup = () => ({
  version: 1,
  savedAt: 1726000000000,
  completed: [{id:'w1'}],
  templates: [{id:'t1'},{id:'t2'}],
  tags: ['Warmup'],
  exerciseTagPresets: [],
  activeProgram: {id:'p1'},
  archivedPrograms: [],
  savedPrograms: [{id:'sp1'}],
  draft: null,
  savedBuilder: null,
  customExercises: [{id:'cx1'}],
  favorites: ['ex1'],
  progressionSetup: {rpeTrigger: 8},
  dashboardPeriod: 'week',
  statsPeriod: 'month',
  logPeriod: 'all',
  savedFilter: {muscles: [], inProgram: false},
});

test('#368 validator accepts a genuine backup', () => {
  const r = obValidateBackupJson(JSON.stringify(goodBackup()));
  assert.equal(r.ok, true);
  assert.equal(r.data.completed.length, 1);
});

test('#368 validator accepts a minimal/older backup (missing newer keys)', () => {
  const r = obValidateBackupJson(JSON.stringify({version: 1, savedAt: 1726000000000, completed: []}));
  assert.equal(r.ok, true, 'older genuine backups must not be rejected for missing keys');
});

test('#368 validator accepts null for nullable object keys', () => {
  const b = goodBackup(); b.draft = null; b.activeProgram = null;
  assert.equal(obValidateBackupJson(JSON.stringify(b)).ok, true);
});

test('#368 validator rejects invalid JSON', () => {
  const r = obValidateBackupJson('{not json');
  assert.equal(r.ok, false);
  assert.match(r.reason, /valid JSON/);
});

test('#368 validator rejects non-objects', () => {
  for (const t of ['[1,2]', 'null', '"str"', '42']) {
    assert.equal(obValidateBackupJson(t).ok, false, t);
  }
});

test('#368 validator rejects missing/non-numeric version', () => {
  assert.equal(obValidateBackupJson('{"savedAt":1}').ok, false);
  assert.equal(obValidateBackupJson('{"version":"1","savedAt":1}').ok, false);
});

test('#368 validator rejects backups from a newer app version', () => {
  const r = obValidateBackupJson(JSON.stringify({version: 2, savedAt: 1}));
  assert.equal(r.ok, false);
  assert.match(r.reason, /newer version/);
});

test('#368 validator rejects missing/non-numeric savedAt', () => {
  assert.equal(obValidateBackupJson('{"version":1}').ok, false);
  assert.equal(obValidateBackupJson('{"version":1,"savedAt":"yesterday"}').ok, false);
});

test('#368 validator rejects unrecognized keys', () => {
  /* A foreign-but-valid JSON object must never pass as a backup. */
  const r = obValidateBackupJson(JSON.stringify({version: 1, savedAt: 1, workouts: [], evil: true}));
  assert.equal(r.ok, false);
  assert.match(r.reason, /app backup/);
});

test('#368 validator rejects wrong value types', () => {
  const bad = goodBackup(); bad.completed = 'nope';
  assert.equal(obValidateBackupJson(JSON.stringify(bad)).ok, false);
  const bad2 = goodBackup(); bad2.draft = 42;
  assert.equal(obValidateBackupJson(JSON.stringify(bad2)).ok, false);
  const bad3 = goodBackup(); bad3.dashboardPeriod = 7;
  assert.equal(obValidateBackupJson(JSON.stringify(bad3)).ok, false);
});

test('#368 validator never touches storage (no mutation before validation)', () => {
  assert.ok(!/localStorage|Storage\.(save|set|delete)/.test(validatorSrc),
    'the validator must be pure — no storage writes');
});

test('#368 backup summary counts', () => {
  const s = obBackupSummary(goodBackup());
  assert.equal(s.completed, 1);
  assert.equal(s.templates, 2);
  assert.equal(s.programs, 2); /* activeProgram + 1 savedProgram */
  assert.equal(s.customExercises, 1);
  assert.ok(s.date instanceof Date);
});

test('#368 execute re-validates before writing', () => {
  const start = csvSrc.indexOf('function obExecuteBackupRestore');
  const end = csvSrc.indexOf('let obRestoreDialogsWired');
  const fnSrc = csvSrc.slice(start, end);
  assert.ok(fnSrc.includes('obValidateBackupJson(JSON.stringify(data))'),
    'execute must re-validate the exact object before any write');
  /* Public fork: no sync engine and no cross-tab tombstones — the restore
     writes the blob straight to local storage (Storage.saveBlob or
     localStorage.setItem) and reloads. */
  assert.ok(!fnSrc.includes('tombstoneAllExceptForSync'),
    'dead cross-tab tombstone call must be gone');
  assert.ok(!fnSrc.includes('Sync.'),
    'no sync-engine references may remain');
  assert.ok(fnSrc.includes('location.reload()'),
    'restore must reload into the restored state');
});

test('#368 import screen accepts .json and routes it to restore', () => {
  assert.ok(csvSrc.includes('.json,application/json'), 'file input must accept .json');
  assert.ok(csvSrc.includes("/\\.json$/i.test(file.name||'')"), 'change handler must branch on .json');
  assert.ok(csvSrc.includes("plan.kind==='backup-restore'"), 'dispatch must route backup plans to the restore confirm');
});

test('#368 two restore dialogs exist in index.html', () => {
  assert.ok(indexSrc.includes('id="restoreBackupDialog"'), 'step-1 dialog missing');
  assert.ok(indexSrc.includes('id="restoreBackupConfirmDialog"'), 'step-2 dialog missing');
  assert.ok(indexSrc.includes('id="restoreBackupConfirm"'), 'final confirm button missing');
});
