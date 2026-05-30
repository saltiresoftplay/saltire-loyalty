'use strict';
const express = require('express');
const router  = express.Router();
const ghl     = require('../lib/ghl');
const auth    = require('../lib/auth');

const QR_BASE   = process.env.QR_GENERATOR_BASE_URL;
const SITE_BASE = process.env.SITE_BASE_URL || 'https://www.saltirecentre.co.uk';

function generateReferralCode(firstName, contactId) {
  const initials = (firstName || 'X').slice(0, 2).toUpperCase();
  const suffix   = contactId.slice(-4).toUpperCase();
  return `${initials}${suffix}`;
}

function buildQrUrl(contactId) {
  const payload = encodeURIComponent(`${SITE_BASE}/portal/dashboard.html?id=${contactId}`);
  return `${QR_BASE}?size=400x400&data=${payload}&color=024C97&bgcolor=FFF6E6&margin=2`;
}

// POST /api/join  — register a new member
// Called from the opt-in confirmation page (after GHL form submit)
router.post('/', async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, referredBy } = req.body;

    if (!phone || !password)
      return res.status(400).json({ error: 'Phone and password required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    // Duplicate check by phone
    const existing = await ghl.findContactByPhone(phone);
    if (existing) {
      return res.status(409).json({
        error: 'An account already exists for this number',
        alreadyMember: true,
      });
    }

    const passwordHash = await auth.hashPassword(password);

    // Create GHL contact
    const contact = await ghl.createContact({
      firstName,
      lastName,
      email,
      phone,
      tags: ['loyalty-member'],
    });

    const contactId    = contact.id;
    const referralCode = generateReferralCode(firstName, contactId);
    const qrUrl        = buildQrUrl(contactId);

    const customUpdates = {
      stampCount:      0,
      lifetimeVisits:  0,
      rewardsRedeemed: 0,
      personalQrUrl:   qrUrl,
      referralCode,
      passwordHash,
      ...(referredBy ? { referredBy } : {}),
    };

    await ghl.updateCustomFields(contactId, customUpdates);

    res.json({
      ok:           true,
      contactId,
      firstName:    contact.firstName || firstName,
      qrUrl,
      referralCode,
    });
  } catch (err) {
    console.error('join error:', err);
    res.status(500).json({ error: 'Registration failed — please try again' });
  }
});

// GET /api/join/qr/:contactId — regenerate QR for a contact
router.get('/qr/:contactId', async (req, res) => {
  try {
    const { contactId } = req.params;
    const qrUrl = buildQrUrl(contactId);
    res.json({ qrUrl });
  } catch (err) {
    res.status(500).json({ error: 'Could not generate QR' });
  }
});

module.exports = router;
