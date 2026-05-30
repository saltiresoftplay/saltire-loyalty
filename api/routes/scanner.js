'use strict';
const express = require('express');
const router  = express.Router();
const ghl     = require('../lib/ghl');

const STAMPS_FOR_REWARD  = parseInt(process.env.STAMPS_REQUIRED_FOR_REWARD || '8', 10);
const COOLDOWN_MS        = parseFloat(process.env.SCAN_COOLDOWN_HOURS || '8') * 60 * 60 * 1000;
const SCANNER_PIN        = process.env.STAFF_SCANNER_PIN;

// Simple PIN middleware — staff must send X-Scanner-Pin header
function requirePin(req, res, next) {
  if (!SCANNER_PIN) return next(); // no PIN set in env — skip check
  if (req.headers['x-scanner-pin'] === SCANNER_PIN) return next();
  res.status(401).json({ error: 'Invalid scanner PIN' });
}

// GET /api/scanner/member/:contactId — preview member before stamping
router.get('/member/:contactId', requirePin, async (req, res) => {
  try {
    const contact = await ghl.getContact(req.params.contactId);
    const parsed  = ghl.parseContact(contact);

    // Check cooldown
    let cooldownActive = false;
    if (parsed.lastScanTimestamp) {
      const elapsed = Date.now() - new Date(parsed.lastScanTimestamp).getTime();
      cooldownActive = elapsed < COOLDOWN_MS;
    }

    res.json({
      id:             parsed.id,
      name:           `${parsed.firstName} ${parsed.lastName}`.trim(),
      stampCount:     parsed.stampCount,
      stampsRequired: STAMPS_FOR_REWARD,
      rewardReady:    parsed.stampCount >= STAMPS_FOR_REWARD,
      cooldownActive,
      lastVisit:      parsed.lastVisitDate,
    });
  } catch (err) {
    console.error('scanner preview error:', err);
    res.status(500).json({ error: 'Could not load member' });
  }
});

// POST /api/scanner/stamp — add a stamp
router.post('/stamp', requirePin, async (req, res) => {
  try {
    const { contactId } = req.body;
    if (!contactId) return res.status(400).json({ error: 'contactId required' });

    const contact = await ghl.getContact(contactId);
    const parsed  = ghl.parseContact(contact);

    // Cooldown check
    if (parsed.lastScanTimestamp) {
      const elapsed = Date.now() - new Date(parsed.lastScanTimestamp).getTime();
      if (elapsed < COOLDOWN_MS) {
        const hoursLeft = Math.ceil((COOLDOWN_MS - elapsed) / 3600000);
        return res.status(429).json({
          error: `Already stamped today — next stamp available in ${hoursLeft}h`,
          cooldownActive: true,
        });
      }
    }

    if (parsed.stampCount >= STAMPS_FOR_REWARD) {
      return res.status(400).json({
        error: 'Member already has a free visit ready — redeem it first',
        rewardReady: true,
      });
    }

    const now          = new Date().toISOString();
    const newCount     = parsed.stampCount + 1;
    const newVisits    = parsed.lifetimeVisits + 1;
    const isFirstVisit = !parsed.firstVisitDate;
    const rewardReady  = newCount >= STAMPS_FOR_REWARD;

    await ghl.updateCustomFields(contactId, {
      stampCount:        newCount,
      lifetimeVisits:    newVisits,
      lastVisitDate:     now,
      lastScanTimestamp: now,
      ...(isFirstVisit ? { firstVisitDate: now } : {}),
    });

    res.json({
      ok:             true,
      name:           `${parsed.firstName} ${parsed.lastName}`.trim(),
      stampCount:     newCount,
      stampsRequired: STAMPS_FOR_REWARD,
      rewardReady,
      lifetimeVisits: newVisits,
    });
  } catch (err) {
    console.error('stamp error:', err);
    res.status(500).json({ error: 'Could not add stamp' });
  }
});

// POST /api/scanner/redeem — redeem a free visit
router.post('/redeem', requirePin, async (req, res) => {
  try {
    const { contactId } = req.body;
    if (!contactId) return res.status(400).json({ error: 'contactId required' });

    const contact = await ghl.getContact(contactId);
    const parsed  = ghl.parseContact(contact);

    if (parsed.stampCount < STAMPS_FOR_REWARD) {
      return res.status(400).json({ error: 'Not enough stamps to redeem' });
    }

    const now = new Date().toISOString();
    await ghl.updateCustomFields(contactId, {
      stampCount:       0,
      rewardsRedeemed:  parsed.rewardsRedeemed + 1,
      lastRewardIssued: now,
    });

    res.json({
      ok:              true,
      name:            `${parsed.firstName} ${parsed.lastName}`.trim(),
      rewardsRedeemed: parsed.rewardsRedeemed + 1,
    });
  } catch (err) {
    console.error('redeem error:', err);
    res.status(500).json({ error: 'Could not redeem reward' });
  }
});

module.exports = router;
