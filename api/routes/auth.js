'use strict';
const express = require('express');
const router  = express.Router();
const ghl     = require('../lib/ghl');
const auth    = require('../lib/auth');

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
};

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password)
      return res.status(400).json({ error: 'Phone and password required' });

    const contact = await ghl.findContactByPhone(phone);
    if (!contact)
      return res.status(401).json({ error: 'No account found for that number' });

    const parsed = ghl.parseContact(contact);
    if (!parsed.passwordHash)
      return res.status(401).json({ error: 'Account not set up yet — check your welcome message' });

    const valid = await auth.verifyPassword(password, parsed.passwordHash);
    if (!valid)
      return res.status(401).json({ error: 'Incorrect password' });

    const token = auth.signToken({ contactId: parsed.id, phone: parsed.phone });
    res.cookie('saltire_token', token, COOKIE_OPTS);
    res.json({ ok: true, firstName: parsed.firstName });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Login failed — please try again' });
  }
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('saltire_token');
  res.json({ ok: true });
});

module.exports = router;
