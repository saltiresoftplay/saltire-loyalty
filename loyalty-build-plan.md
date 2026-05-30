# Saltire Loyalty + Referral — Build Plan

Phase 2 add-on to the GHL site rebuild. GHL is the backend (no separate DB).

## Architecture

```
Customer opt-in QR (in venue) ──► GHL contact created + opt-in captured
                                        │
                                        ▼
                            Workflow: generate personal QR
                            (encodes contact ID), send via SMS/email
                                        │
                                        ▼
Customer shows personal QR at door ──► Staff scanner page reads QR ──► GHL API: +1 stamp
                                                                            │
                                                                  ┌─────────┴─────────┐
                                                                  ▼                   ▼
                                                          Stamp count < 8       Stamp count = 8
                                                          (no action)           Trigger reward
                                                                                workflow + reset
```

## GHL contact custom fields

| Field | Type | Notes |
|---|---|---|
| `stamp_count` | Number | 0–8, resets to 0 on reward issue |
| `lifetime_visits` | Number | Never resets |
| `last_visit_date` | Date | Updated on each scan |
| `personal_qr_url` | Text | Hosted QR image URL |
| `referral_code` | Text | Short unique code |
| `referred_by` | Text | Referral code of referrer |
| `rewards_redeemed` | Number | Lifetime reward count |
| `last_reward_issued` | Date | For audit |

## Components to build

### 1. Staff scanner page (custom web page)
- Mobile-friendly, runs on staff tablet/phone
- Uses device camera + JS QR library
- On scan: POST to GHL API → increment `stamp_count`, update `last_visit_date`, +1 `lifetime_visits`
- UI feedback: customer name, "Stamp X of 8" or "🎉 Free visit unlocked!"
- Auth: staff PIN to access

### 2. Customer "my stamps" page (GHL funnel page)
- Customer scans their own QR or follows SMS link
- Shows: name, current stamps (visual 8-stamp card), referral code/link, rewards available
- Built as a GHL funnel page with merge tags — minimal/no custom code

### 3. GHL workflows
- **On opt-in:** generate referral code, generate QR image, store URL, send welcome SMS/email with personal QR
- **On stamp increment via API:** if `stamp_count` >= 8, fire reward workflow
- **Reward workflow:** SMS/email "free visit unlocked", set `stamp_count` = 0, +1 `rewards_redeemed`
- **On referral:** when new contact's `referred_by` is set + first visit completed, reward both contacts (free coffee for each)

### 4. QR generation
- On contact creation, workflow calls a QR generator (e.g. api.qrserver.com or self-hosted) with payload = contact ID
- Store image URL in `personal_qr_url`
- Embed in welcome SMS/email and in "my stamps" page

## Open items before build

1. GHL sub-account API key + location ID (owner to provide)
2. "Visit" definition — any entry, or paid-entry only?
3. Referral caps — max per referrer per month?
4. Staff door hardware — existing tablet, or do we spec one?
5. GDPR opt-in wording sign-off
6. Launch timing — alongside new site or after go-live?
7. Quote sign-off

## Phasing suggestion

- **Phase 2a (MVP):** loyalty stamps + reward only — fastest path to value
- **Phase 2b:** referral system layered on top once loyalty is bedded in
