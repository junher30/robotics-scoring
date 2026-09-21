const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function load(file, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => name in dependencies ? dependencies[name] : require(name), Date });
  return module.exports;
}
const schema = load('lib/categories/schema.ts');
const eventId = '00000000-0000-4000-8000-000000000001';
const foreignEvent = '00000000-0000-4000-8000-000000000002';
const categoryId = '00000000-0000-4000-8000-000000000010';
const valid = { ...schema.emptyCategory, name: 'Mini Sumo' };
function form(change = {}) {
  const result = new FormData();
  Object.entries({ ...valid, ...change }).forEach(([key, value]) => result.set(key, value));
  return result;
}
function fixture() {
  const rows = new Map();
  const state = { denied: false, parentVisible: true, offline: false, writes: 0 };
  const action = load('app/admin/eventos/[id]/categorias/actions.ts', {
    '../../../../../lib/categories/schema': schema,
    '../../../../../lib/auth/authorization': { requireAccess: async area => { assert.equal(area, 'admin'); if (state.denied) throw Error('DENIED'); } },
    'next/navigation': { redirect: url => { throw Error('REDIRECT ' + url); } },
    'next/cache': { revalidatePath: () => {} },
    '../../../../../lib/supabase/server': { createClient: async () => ({ from(table) {
      if (state.offline) throw Error('offline');
      const filters = []; let payload;
      const duplicate = (candidate, id) => [...rows.values()].some(row => row.id !== id && row.event_id === candidate.event_id && row.name.trim().toLowerCase() === candidate.name.trim().toLowerCase());
      const query = {
        select: () => query,
        eq: (key, value) => { filters.push([key, value]); return query; },
        update: data => { payload = data; return query; },
        async insert(data) {
          state.writes++;
          if (rows.has(data.id) || duplicate(data)) return { error: { code: '23505' } };
          rows.set(data.id, { ...data, updated_at: '2026-09-20T12:00:00.000Z' });
          return { error: null };
        },
        async maybeSingle() {
          if (table === 'events') return { data: state.parentVisible && filters.every(([key, value]) => key === 'id' && value === eventId) ? { id: eventId } : null, error: null };
          const row = [...rows.values()].find(item => filters.every(([key, value]) => item[key] === value));
          if (row && payload) {
            if (duplicate({ ...row, ...payload }, row.id)) return { data: null, error: { code: '23505' } };
            state.writes++; Object.assign(row, payload, { updated_at: '2026-09-20T12:01:00.000Z' });
          }
          return { data: row ?? null, error: null };
        },
      };
      return query;
    } }) },
  });
  return { rows, state, save: action.saveCategory };
}
for (const [label, data] of [
  ['empty name', { name: '   ' }], ['long name', { name: 'a'.repeat(101) }], ['long description', { description: 'a'.repeat(3001) }],
  ['zero capacity', { max_teams: '0' }], ['fractional capacity', { max_teams: '1.5' }], ['negative order', { sort_order: '-1' }],
  ['missing order', { sort_order: '' }], ['overflow order', { sort_order: '2147483648' }], ['unknown status', { status: 'REGISTRATION' }],
]) test('Rejects ' + label, () => assert.equal(schema.categorySchema.safeParse({ ...valid, ...data }).success, false));
test('Trims name and allows unset capacity with zero order', () => {
  const payload = schema.categoryPayload(schema.categorySchema.parse({ ...valid, name: ' Mini Sumo ' }));
  assert.equal(payload.name, 'Mini Sumo'); assert.equal(payload.max_teams, null); assert.equal(payload.sort_order, 0);
});
test('Requires authorization before every write', async () => {
  const f = fixture(); f.state.denied = true;
  await assert.rejects(f.save(eventId, categoryId, null, {}, form()), { message: 'DENIED' }); assert.equal(f.state.writes, 0);
});
test('Inaccessible parent prevents creation', async () => {
  const f = fixture(); f.state.parentVisible = false;
  const result = await f.save(eventId, categoryId, null, {}, form()); assert.match(result.message, /acceso/); assert.equal(f.state.writes, 0);
});
test('Bound event id is authoritative and retries do not duplicate', async () => {
  const f = fixture(); const body = form(); body.set('event_id', foreignEvent);
  for (let i = 0; i < 2; i++) await assert.rejects(f.save(eventId, categoryId, null, {}, body), { message: `REDIRECT /admin/eventos/${eventId}/categorias/${categoryId}?resultado=creada` });
  assert.equal(f.rows.size, 1); assert.equal(f.rows.get(categoryId).event_id, eventId);
});
test('Duplicate name shows field error and retains values', async () => {
  const f = fixture(); f.rows.set('existing', { ...valid, id: 'existing', event_id: eventId });
  const result = await f.save(eventId, categoryId, null, {}, form({ name: ' MINI SUMO ' }));
  assert(result.errors.name); assert.equal(result.values.name, ' MINI SUMO '); assert.equal(f.rows.size, 1);
});
test('Cannot update category through the wrong parent route', async () => {
  const f = fixture(); f.rows.set(categoryId, { ...valid, id: categoryId, event_id: foreignEvent, updated_at: '2026-09-20T12:00:00.000Z' });
  const result = await f.save(eventId, categoryId, '2026-09-20T12:00:00.000Z', {}, form({ name: 'Changed' }));
  assert.match(result.message, /acceso/); assert.equal(f.rows.get(categoryId).name, valid.name); assert.equal(f.state.writes, 0);
});
test('Stale edit preserves newer data', async () => {
  const f = fixture(); f.rows.set(categoryId, { ...valid, id: categoryId, event_id: eventId, updated_at: '2026-09-20T12:01:00.000Z' });
  const result = await f.save(eventId, categoryId, '2026-09-20T12:00:00.000Z', {}, form({ name: 'Old change' }));
  assert.match(result.message, /otra sesión/); assert.equal(f.rows.get(categoryId).name, valid.name);
});
test('Closing and changing order preserves category', async () => {
  const f = fixture(); f.rows.set(categoryId, { ...valid, id: categoryId, event_id: eventId, updated_at: '2026-09-20T12:00:00.000Z' });
  await assert.rejects(f.save(eventId, categoryId, '2026-09-20T12:00:00.000Z', {}, form({ status: 'CLOSED', sort_order: '12' })), { message: `REDIRECT /admin/eventos/${eventId}/categorias/${categoryId}?resultado=guardada` });
  assert.equal(f.rows.get(categoryId).status, 'CLOSED'); assert.equal(f.rows.get(categoryId).sort_order, 12); assert.equal(f.rows.size, 1);
});
test('Offline failure keeps the entered values', async () => {
  const f = fixture(); f.state.offline = true;
  const result = await f.save(eventId, categoryId, null, {}, form()); assert.match(result.message, /conexión/); assert.equal(result.values.name, valid.name);
});
