import assert from 'node:assert/strict';
import { once } from 'node:events';
import { before, after, test } from 'node:test';
import app from '../src/app.js';
import Reservation from '../src/models/Reservation.js';
import Enquiry from '../src/models/Enquiry.js';

let server;
let base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = 'http://127.0.0.1:' + server.address().port + '/api/v1';
});
after(() => new Promise(resolve => server.close(resolve)));

function post(path, body) {
  return fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const booking = {
  branch: 'whitefield', date: '2030-01-31', time: '12:30 PM', guests: 2,
  customer: { name: 'Test Guest', email: 'guest@example.test' },
};
const enquiry = {
  type: 'private-dining', branch: 'whitefield', name: 'Test Guest',
  email: 'guest@example.test', message: 'A table for a group lunch.',
};

test('a requested date survives capacity lookup at a month boundary', async t => {
  t.mock.method(Reservation, 'countDocuments', async query => {
    assert.equal(query.date.$gte.toISOString(), '2030-01-31T00:00:00.000Z');
    assert.equal(query.date.$lt.toISOString(), '2030-02-01T00:00:00.000Z');
    return 0;
  });
  t.mock.method(Reservation, 'create', async data => ({
    ...data, status: 'pending',
  }));
  const response = await post('/reservations', booking);
  assert.equal(response.status, 201);
  const { data } = await response.json();
  assert.equal(data.date, '2030-01-31T00:00:00.000Z');
  assert.equal(data.status, 'pending');
  assert.match(data.reference, /^MM-/);
});

test('a full seating returns conflict without writing a reservation', async t => {
  t.mock.method(Reservation, 'countDocuments', async () => 20);
  const create = t.mock.method(Reservation, 'create', () => assert.fail('Unexpected write'));
  assert.equal((await post('/reservations', booking)).status, 409);
  assert.equal(create.mock.callCount(), 0);
});

test('enquiries are acknowledged with a reference only after a successful write', async t => {
  const create = t.mock.method(Enquiry, 'create', async record => record);
  const response = await post('/enquiries', enquiry);
  assert.equal(response.status, 201);
  const { data } = await response.json();
  assert.deepEqual(Object.keys(data), ['reference']);
  assert.match(data.reference, /^MM-E-/);
  assert.deepEqual(create.mock.calls[0].arguments[0], { ...enquiry, reference: data.reference });
});

test('invalid enquiry and booking bodies are rejected before storage', async t => {
  const save = t.mock.method(Enquiry, 'create', () => assert.fail('Unexpected write'));
  const count = t.mock.method(Reservation, 'countDocuments', () => assert.fail('Unexpected lookup'));
  assert.equal((await post('/enquiries', { ...enquiry, email: 'invalid' })).status, 400);
  assert.equal((await post('/reservations', { ...booking, guests: 0 })).status, 400);
  assert.equal(save.mock.callCount(), 0);
  assert.equal(count.mock.callCount(), 0);
});
