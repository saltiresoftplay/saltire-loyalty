'use strict';
const express = require('express');
const router  = express.Router();
const ghl     = require('../lib/ghl');
const auth    = require('../lib/auth');
const { requireAuth } = auth;

// GET /api/member/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const contact = await ghl.getContact(req.member.contactId);
    const parsed  = ghl.parseContact(contact);

    // Fetch linked partner name if set
    let partnerName = null;
    if (parsed.familyLinkedId) {
      try {
        const partner = await ghl.getContact(parsed.familyLinkedId);
        partnerName = `${partner.firstName || ''} ${partner.lastName || ''}`.trim();
      } catch { /* partner contact may have been deleted */ }
    }

    res.json({ ...parsed, passwordHash: undefined, partnerName });
  } catch (err) {
    console.error('member/me error:', err);
    res.status(500).json({ error: 'Could not load your account' });
  }
});

// PUT /api/member/family  — link a partner by their phone number
router.put('/family', requireAuth, async (req, res) => {
  try {
    const { partnerPhone } = req.body;
    if (!partnerPhone)
      return res.status(400).json({ error: 'Partner phone required' });

    const partner = await ghl.findContactByPhone(partnerPhone);
    if (!partner)
      return res.status(404).json({ error: 'No Saltire account found for that number' });

    if (partner.id === req.member.contactId)
      return res.status(400).json({ error: 'That is your own number' });

    // Link both ways
    await Promise.all([
      ghl.updateCustomFields(req.member.contactId, { familyLinkedId: partner.id }),
      ghl.updateCustomFields(partner.id, { familyLinkedId: req.member.contactId }),
    ]);

    const partnerParsed = ghl.parseContact(partner);
    res.json({ ok: true, partnerName: `${partnerParsed.firstName} ${partnerParsed.lastName}`.trim() });
  } catch (err) {
    console.error('family link error:', err);
    res.status(500).json({ error: 'Could not link partner' });
  }
});

// PUT /api/member/children  — save up to 4 children
// Body: { children: [{ name, dob }, ...] }
router.put('/children', requireAuth, async (req, res) => {
  try {
    const { children } = req.body;
    if (!Array.isArray(children) || children.length > 4)
      return res.status(400).json({ error: 'Up to 4 children allowed' });

    const updates = {};
    for (let i = 0; i < 4; i++) {
      const child = children[i] || {};
      updates[`child${i + 1}Name`] = child.name || '';
      updates[`child${i + 1}Dob`]  = child.dob  || '';
    }

    await ghl.updateCustomFields(req.member.contactId, updates);
    res.json({ ok: true });
  } catch (err) {
    console.error('children update error:', err);
    res.status(500).json({ error: 'Could not save children' });
  }
});

// PUT /api/member/password
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const contact = await ghl.getContact(req.member.contactId);
    const parsed  = ghl.parseContact(contact);

    const valid = await auth.verifyPassword(currentPassword, parsed.passwordHash);
    if (!valid)
      return res.status(401).json({ error: 'Current password incorrect' });

    const newHash = await auth.hashPassword(newPassword);
    await ghl.updateCustomFields(req.member.contactId, { passwordHash: newHash });
    res.json({ ok: true });
  } catch (err) {
    console.error('password change error:', err);
    res.status(500).json({ error: 'Could not update password' });
  }
});

module.exports = router;
