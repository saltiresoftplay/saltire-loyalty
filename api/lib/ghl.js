'use strict';
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const BASE_URL = process.env.GHL_API_BASE_URL;
const TOKEN    = process.env.GHL_API_TOKEN;
const VERSION  = process.env.GHL_API_VERSION;
const LOC_ID   = process.env.GHL_LOCATION_ID;

const FIELDS = {
  stampCount:        process.env.GHL_FIELD_STAMP_COUNT,
  lifetimeVisits:    process.env.GHL_FIELD_LIFETIME_VISITS,
  firstVisitDate:    process.env.GHL_FIELD_FIRST_VISIT_DATE,
  lastVisitDate:     process.env.GHL_FIELD_LAST_VISIT_DATE,
  lastScanTimestamp: process.env.GHL_FIELD_LAST_SCAN_TIMESTAMP,
  personalQrUrl:     process.env.GHL_FIELD_PERSONAL_QR_URL,
  referralCode:      process.env.GHL_FIELD_REFERRAL_CODE,
  referredBy:        process.env.GHL_FIELD_REFERRED_BY,
  rewardsRedeemed:   process.env.GHL_FIELD_REWARDS_REDEEMED,
  lastRewardIssued:  process.env.GHL_FIELD_LAST_REWARD_ISSUED,
  passwordHash:      process.env.GHL_FIELD_PASSWORD_HASH,
  familyLinkedId:    process.env.GHL_FIELD_FAMILY_LINKED_ID,
  child1Name:        process.env.GHL_FIELD_CHILD_1_NAME,
  child1Dob:         process.env.GHL_FIELD_CHILD_1_DOB,
  child2Name:        process.env.GHL_FIELD_CHILD_2_NAME,
  child2Dob:         process.env.GHL_FIELD_CHILD_2_DOB,
  child3Name:        process.env.GHL_FIELD_CHILD_3_NAME,
  child3Dob:         process.env.GHL_FIELD_CHILD_3_DOB,
  child4Name:        process.env.GHL_FIELD_CHILD_4_NAME,
  child4Dob:         process.env.GHL_FIELD_CHILD_4_DOB,
  partyDate:         process.env.GHL_FIELD_PARTY_DATE,
  partyPackage:      process.env.GHL_FIELD_PARTY_PACKAGE,
  partyGuestCount:   process.env.GHL_FIELD_PARTY_GUEST_COUNT,
  partyNotes:        process.env.GHL_FIELD_PARTY_NOTES,
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
