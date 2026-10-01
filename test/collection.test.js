const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase, createCardStore } = require('../src/db');
const { validateCard } = require('../src/validation');
const { createApp } = require('../src/server');

const sample = {
  name: 'Sol Ring', setCode: 'cmm', setName: 'Commander Masters', collectorNumber: '396',
  finish: 'nonfoil', condition: 'NM', quantity: '2', scryfallId: 'd4d009f2-63c6-4fb9-86da-4b9be6c3305f'
};

function makeStore(namespaceId = 'personal') {
  const db = createDatabase(':memory:');
  return { db, store: createCardStore(db, namespaceId) };
}

test('validates required fields and names the invalid field', () => {
  const result = validateCard({ ...sample, setCode: '' });
  assert.equal(result.success, false);
  assert.ok(result.errors.some((issue) => issue.field === 'setCode'));
});

test('normalizes set codes and combines duplicate printing quantities', () => {
  const { db, store } = makeStore();
  const card = validateCard(sample).data;
  store.addMany([card, { ...card, quantity: 3 }]);
  assert.equal(store.count().count, 1);
  assert.equal(store.count().copies, 5);
  assert.equal(store.list()[0].setCode, 'CMM');
  db.close();
});

test('every collection query stays inside its namespace', () => {
  const db = createDatabase(':memory:');
  const personal = createCardStore(db, 'personal');
  const second = createCardStore(db, 'other');
  const card = validateCard(sample).data;
  personal.addMany([card]);
  second.addMany([{ ...card, name: 'A different namespace copy' }]);
  assert.equal(personal.list()[0].name, 'Sol Ring');
  assert.equal(personal.count().copies, 2);
  assert.equal(second.list()[0].name, 'A different namespace copy');
  db.close();
});

test('single entry saves a complete card and reports field-specific errors', async (t) => {
  const { db, store } = makeStore();
  const server = createApp({ store }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.close(); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const valid = await fetch(`${base}/api/cards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sample) });
  assert.equal(valid.status, 201);
  const invalid = await fetch(`${base}/api/cards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sample, condition: '' }) });
  assert.equal(invalid.status, 400);
  assert.ok((await invalid.json()).errors.some((issue) => issue.field === 'condition'));
  const list = await fetch(`${base}/api/cards`).then((response) => response.json());
  assert.equal(list.cards.length, 1);
  assert.equal(list.cards[0].quantity, 2);
});

test('bulk CSV is all-or-nothing and combines valid duplicate rows', async (t) => {
  const { db, store } = makeStore();
  const server = createApp({ store }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.close(); db.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/cards/import`;
  const headers = 'name,setCode,setName,collectorNumber,finish,condition,quantity,scryfallId';
  const row = 'Sol Ring,CMM,Commander Masters,396,nonfoil,NM,2,d4d009f2-63c6-4fb9-86da-4b9be6c3305f';
  const valid = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: `${headers}\n${row}\n${row}` });
  assert.equal(valid.status, 201);
  assert.equal((await valid.json()).imported, 2);
  assert.equal(store.count().copies, 4);
  const invalid = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: `${headers}\n${row}\n,${row.split(',').slice(1).join(',')}` });
  assert.equal(invalid.status, 400);
  assert.equal(store.count().copies, 4);
});
