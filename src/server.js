const path = require('node:path');
const express = require('express');
const { parse } = require('csv-parse/sync');
const { createDatabase, createCardStore } = require('./db');
const { validateCard } = require('./validation');
const { createRateLimiter } = require('./rate-limit');

function createApp({ store = createCardStore(createDatabase(), process.env.COLLECTION_NAMESPACE_ID || 'personal') } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', createRateLimiter());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/cards', (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : '';
    const page = Math.min(100000, Math.max(0, Number.parseInt(req.query.page, 10) || 0));
    const cards = store.list({ search, limit: 500, offset: page * 500 });
    res.json({ cards, summary: store.count(), page, pageSize: 500 });
  });

  app.post('/api/cards', (req, res) => {
    const result = validateCard(req.body);
    if (!result.success) return res.status(400).json({ error: 'Card validation failed', errors: result.errors });
    store.addMany([result.data]);
    return res.status(201).json({ message: 'Card saved. Matching copies are combined.', summary: store.count() });
  });

  app.post('/api/cards/import', express.text({ type: ['text/csv', 'text/plain'], limit: '5mb' }), (req, res) => {
    let rows;
    try {
      rows = parse(req.body || '', { columns: true, bom: true, skip_empty_lines: true, trim: true, relax_column_count: false });
    } catch (error) {
      return res.status(400).json({ error: 'Could not parse CSV', details: error.message });
    }
    if (!rows.length) return res.status(400).json({ error: 'CSV must include at least one card row.' });
    if (rows.length > 5000) return res.status(413).json({ error: 'CSV is limited to 5,000 card rows.' });
    const required = ['name', 'setCode', 'setName', 'collectorNumber', 'finish', 'condition', 'quantity', 'scryfallId'];
    const headers = Object.keys(rows[0]);
    const missingHeaders = required.filter((header) => !headers.includes(header));
    if (missingHeaders.length) return res.status(400).json({ error: 'CSV is missing required columns', errors: missingHeaders.map((field) => ({ field, message: `Column ${field} is required` })) });
    const errors = [];
    const cards = [];
    rows.forEach((row, index) => {
      const result = validateCard(row);
      if (result.success) cards.push(result.data);
      else result.errors.forEach((issue) => errors.push({ row: index + 2, ...issue }));
    });
    if (errors.length) return res.status(400).json({ error: 'CSV validation failed; no rows were imported.', errors: errors.slice(0, 100), totalErrors: errors.length });
    store.addMany(cards);
    return res.status(201).json({ imported: cards.length, message: 'Rows imported. Matching copies were combined.', summary: store.count() });
  });

  app.get('/api/template.csv', (_req, res) => {
    res.type('text/csv').send('name,setCode,setName,collectorNumber,finish,condition,quantity,scryfallId\n');
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found' }));
  app.use((error, _req, res, _next) => {
    const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error(error);
    res.status(status).json({ error: status === 500 ? 'Unexpected server error' : 'Request could not be processed' });
  });
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  createApp().listen(port, host, () => console.log(`MTG collection is available at http://${host}:${port}`));
}

module.exports = { createApp };
