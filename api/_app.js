'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express      = require('express');
const cookieParser = require('cookie-parser');
const cors         = require('cors');
const path         = require('path');

const app = express();

app.use(cors({
  origin: process.env.SITE_BASE_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Static files — used in local dev only (Vercel serves them natively)
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.resolve(__dirname, '..')));
}

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/member',  require('./routes/member'));
app.use('/api/scanner', require('./routes/scanner'));
app.use('/api/join',    require('./routes/join'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── Fallback ──────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

module.exports = app;
