'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const BASE_URL = 'https://services.leadconnectorhq.com';
const TOKEN    = process.env.GHL_API_TOKEN;
const VERSION  = '2021-07-28';
const LOC_ID   = process.env.GHL_LOCATION_ID;

const FIELDS = {
  stampCount:        'g8EBSAicAXcfS32PAlZO',
  lifetimeVisits:    'qdNIirCcOMquoStAzRBp',
  firstVisitDate:    'CWRlsk3dJ4VG0cUkwK0K',
  lastVisitDate:     'TcN4fstOuff5xVGe5Jwx',
  lastScanTimestamp: 'RLijEa02hBzeg4ixeaGz',
  personalQrUrl:     '3zTHmUdMlCRQtWgcTmqs',
  referralCode:      'Y7sIxdotUfcz4zu9qG8S',
  referredBy:        'gc8JmKKA7SCXC7dbyhOl',
  rewardsRedeemed:   'iuU3ZgLZrKfax5sUILl9',
  lastRewardIssued:  '3OZAyCckqmnhXb3RTHAv',
  passwordHash:      '0DZlNdpsilXyWT5rezsk',
  familyLinkedId:    'AxezlcHfuZhV6jEEgenT',
  child1Name:        'mYYd3f2rXjWmEb33an6N',
  child1Dob:         'TFDgao7cDioMFQ4AENvz',
  child2Name:        '7FvMu98kWec0WgastbkV',
  child2Dob:         'faWokBrIbEBI19dXUQiK',
  child3Name:        '4Fnt9e1cDeQ6Y7um2WqC',
  child3Dob:         'ZAZmaWMFCl9dbylJcLKE',
  child4Name:        '39OigsGWguIS8QYyFI0P',
  child4Dob:         'jTFdpSJDp0HWGNFAOJuP',
  partyDate:         'NTioNR8K9cPYrXS0WDfW',
  partyPackage:      'Rk3q0wh7YHPzPTyPJX7E',
  partyGuestCount:   'nocWSCQn7GnONilE5mfC',
  partyNotes:        '55QCGb5wb5yltkqP7JtD',
};

function headers() {
  return {
    'Authorization': `Bearer ${TOKEN}`,
    'Version': VERSION,
    'Content-Type': 'application/json',
  };
}

async function ghlFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GHL ${options.method || 'GET'} ${path} → ${res.status}: ${body}`);
  }
  return res.json();
}

// ── Contact lookups ──────────────────────────────────────────────────────────

async function getContact(contactId) {
  const data = await ghlFetch(`/contacts/${contactId}`);
  return data.contact;
}

async function findContactByPhone(phone) {
  const normalised = phone.replace(/\s+/g, '').replace(/^0/, '+44');
  const data = await ghlFetch(
    `/contacts/?locationId=${LOC_ID}&query=${encodeURIComponent(normalised)}&limit=5`
  );
  const contacts = data.contacts || [];
  return contacts.find(c => {
    const p = (c.phone || '').replace(/\s+/g, '').replace(/^0/, '+44');
    return p === normalised;
  }) || null;
}

// ── Custom field helpers ─────────────────────────────────────────────────────

function getCustomField(contact, fieldKey) {
  const fieldId = FIELDS[fieldKey];
  if (!fieldId) return null;
  const cf = (contact.customFields || []).find(f => f.id === fieldId);
  return cf ? cf.value : null;
}

function buildCustomFieldUpdates(updates) {
  return Object.entries(updates)
    .filter(([key]) => FIELDS[key])
    .map(([key, value]) => ({ id: FIELDS[key], value: String(value ?? '') }));
}

// ── Contact mutations ────────────────────────────────────────────────────────

async function updateContact(contactId, payload) {
  return ghlFetch(`/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

async function updateCustomFields(contactId, updates) {
  const customFields = buildCustomFieldUpdates(updates);
  return updateContact(contactId, { customFields });
}

async function createContact(payload) {
  const data = await ghlFetch('/contacts/', {
    method: 'POST',
    body: JSON.stringify({ ...payload, locationId: LOC_ID }),
  });
  return data.contact;
}

// ── Parsed contact helper ────────────────────────────────────────────────────
// Returns a clean object for the portal — no raw GHL shape leaking to frontend.

function parseContact(contact) {
  const cf = (key) => getCustomField(contact, key);
  return {
    id:                contact.id,
    firstName:         contact.firstName || '',
    lastName:          contact.lastName  || '',
    email:             contact.email     || '',
    phone:             contact.phone     || '',
    stampCount:        parseInt(cf('stampCount')        || '0', 10),
    lifetimeVisits:    parseInt(cf('lifetimeVisits')    || '0', 10),
    firstVisitDate:    cf('firstVisitDate')    || null,
    lastVisitDate:     cf('lastVisitDate')     || null,
    lastScanTimestamp: cf('lastScanTimestamp') || null,
    personalQrUrl:     cf('personalQrUrl')     || null,
    referralCode:      cf('referralCode')      || null,
    rewardsRedeemed:   parseInt(cf('rewardsRedeemed')   || '0', 10),
    lastRewardIssued:  cf('lastRewardIssued')  || null,
    passwordHash:      cf('passwordHash')      || null,
    familyLinkedId:    cf('familyLinkedId')    || null,
    children: [
      { name: cf('child1Name'), dob: cf('child1Dob') },
      { name: cf('child2Name'), dob: cf('child2Dob') },
      { name: cf('child3Name'), dob: cf('child3Dob') },
      { name: cf('child4Name'), dob: cf('child4Dob') },
    ].filter(c => c.name),
    party: cf('partyDate') ? {
      date:       cf('partyDate'),
      package:    cf('partyPackage')    || '',
      guestCount: cf('partyGuestCount') || '',
      notes:      cf('partyNotes')      || '',
    } : null,
  };
}

module.exports = {
  FIELDS,
  getContact,
  findContactByPhone,
  getCustomField,
  updateContact,
  updateCustomFields,
  createContact,
  parseContact,
};
