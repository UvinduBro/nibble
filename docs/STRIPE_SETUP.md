# Nibble Premium: Stripe set-up guide

For whoever sets up the payment gateway. About 30 minutes. Everything happens in the **Stripe
dashboard**, **Vercel** (where meetnibble.com runs) and the **Nibble admin panel**
(https://meetnibble.com/admin → Money → Premium). Never send keys by email or chat: paste them
straight into Vercel.

What gets created:

| Where | What | Value looks like |
|---|---|---|
| Stripe | Webhook endpoint `https://meetnibble.com/api/stripe/webhook` (15 events) | – |
| Vercel env | `STRIPE_SECRET_KEY` | a restricted key `rk_test_…` / `rk_live_…` (or `sk_…`) |
| Vercel env | `STRIPE_WEBHOOK_SECRET` | `whsec_…` (two, comma-separated, while rotating) |

Nothing else is needed: no publishable key (Nibble uses Stripe's hosted checkout page).

How it works, in one paragraph: the app asks `/api/billing/checkout` for a payment page. The server
checks the account (verified email, not a temporary email address, not suspended, no open fraud
flag), picks the price from the saved plan, and creates a Stripe Checkout Session with a required
billing address, a terms tick-box and about 40 fraud-prevention metadata fields (account age,
sign-in method, sign-up country vs. connection country, hashed network id, device info…). The same
fields are put on the Stripe customer so Radar rules can use them. Stripe tells us what happened
through the webhook. Each event is handled exactly once, and disputes and early fraud warnings end
Premium and flag the account in Admin → Premium.

---

## Part 0: business details (before going live)

Stripe's underwriting team compares the website with what you enter in Stripe. They must match.

- **Legal business name:** Entryly Solutions LLC
- **Business address:** 215 W Pershing Rd, Ste 403-645, Kansas City, MO 64108, USA
- **Website:** https://meetnibble.com
- **Product description:** "Optional subscription for extra features in the Nibble desktop pet app
  (a free app for Windows and Mac). Billed weekly, monthly or yearly; cancel any time; full refund
  within 14 days."
- **Support email:** hello@meetnibble.com

The website already shows all of this on https://meetnibble.com/pricing,
https://meetnibble.com/refunds, https://meetnibble.com/terms and https://meetnibble.com/privacy.
Make sure these pages are **deployed before** you submit live-mode activation.

In Stripe → **Settings → Business → Public details**:
1. Public business name: `Nibble`
2. Support email: `hello@meetnibble.com`
3. Website: `https://meetnibble.com`
4. **Terms of service URL:** `https://meetnibble.com/terms` (required: checkout shows a
   "I agree to the terms" tick-box, and without this URL it falls back to no tick-box. The admin
   checklist warns you about it.)
5. **Refund policy URL:** `https://meetnibble.com/refunds`
6. **Privacy policy URL:** `https://meetnibble.com/privacy`
7. **Statement descriptor:** `MEETNIBBLE.COM` (what people see on their card statement; a name
   they recognise prevents "I don't know this charge" disputes). Shortened descriptor: `NIBBLE`.

---

## Part 1: test mode first

### 1. Stripe account
1. Sign in at https://dashboard.stripe.com (the Entryly Solutions LLC account).
2. Turn on **Test mode** (toggle at the top right). Everything in Part 1 happens in test mode.

### 2. Restricted secret key (recommended)
1. Stripe → **Developers → API keys → Create restricted key**, name it `Nibble server`.
2. Give it these permissions (everything else: None):
   - **Write:** Customers, Checkout Sessions, Subscriptions, Prices, Products, Coupons,
     Promotion codes, Customer portal, Refunds
   - **Read:** Charges, Disputes, Invoices, Webhook endpoints, Account (connected account / "All
     account" read), Radar → Early fraud warnings
3. Copy the `rk_test_…` key. (A full `sk_test_…` key also works, but a restricted key does far less
   damage if it ever leaks. The admin checklist shows which one you're using.)

### 3. Webhook endpoint
1. Stripe → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://meetnibble.com/api/stripe/webhook`
3. **API version:** pick the version shown in Admin → Premium → Stripe set-up ("Webhook API version
   matches the app"). It's the version of the Stripe library in `package.json`.
4. Select these **15 events**:
   - `checkout.session.completed`, `checkout.session.expired`
   - `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
   - `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.trial_will_end`
   - `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`
   - `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`
   - `radar.early_fraud_warning.created`
5. Click **Add endpoint**, then on the endpoint page click **Reveal** under **Signing secret**
   and copy it (`whsec_…`).

### 4. Customer portal (lets people cancel or change their card)
1. Stripe → **Settings → Billing → Customer portal**.
2. Turn on: cancel subscriptions (**at end of billing period**), update payment methods, view
   invoice history. Add the terms and privacy links there too.
3. Click **Save** (this step is required once in test mode and once in live mode).

### 5. Customer emails
Stripe → **Settings → Billing → Subscriptions and emails** (and **Settings → Emails**):
- Send **receipts** for successful payments and refunds.
- **Trial ending reminder** (7 days before). Card networks require this for free trials.
- **Upcoming renewal reminder** for yearly plans.
- **Failed payment** emails and the link to update the card.
- **Expiring card** reminders.
- **3-D Secure / "confirm your payment"** emails (the app also shows a banner).
- Turn on **Smart Retries** for failed payments.

### 6. Radar (fraud rules)
Stripe → **Radar → Rules**. Turn these on (they're free with standard Radar):
- Block if `:risk_level: = 'highest'` (on by default)
- Review if `:risk_level: = 'elevated'`
- Block if `:cvc_check: = 'fail'`
- Block if `:address_zip_check: = 'fail'` (checkout always asks for the billing address)
- Optional: Block if `:card_funding: = 'prepaid'` (prepaid cards are a common fraud source)

With **Radar for Fraud Teams** you can also write rules on the fields Nibble adds to the customer:
- Review if `::customer:nb_country_mismatch:: = 'true'`
- Review if `::customer:nb_acct_age_days:: < 1`
- Block if `::customer:nb_checkouts_24h:: > 5`

### 7. Add the keys in Vercel
1. Vercel → project **nibble** → **Settings → Environment Variables**.
2. Add, for the **Production** environment, type **Sensitive**:
   - `STRIPE_SECRET_KEY` = the `rk_test_…` (or `sk_test_…`) key
   - `STRIPE_WEBHOOK_SECRET` = the `whsec_…` secret
3. **Redeploy**: Vercel → Deployments → latest production deployment → ⋯ → **Redeploy**
   (environment variables only apply after a new deployment).

### 8. Check it in the admin panel
https://meetnibble.com/admin → **Premium** → **Stripe set-up** → **Re-check**. Every line should
show ✓:
- Secret key in Vercel (shows TEST mode and the Stripe account name)
- Webhook signing secret in Vercel
- Webhook endpoint in Stripe (warns if an event is missing)
- Webhook API version matches the app
- Customer portal turned on
- Terms of service URL set in Stripe
- Fraud warnings readable (Radar)
- Restricted key
- Server can update Firestore (if not: in Google Cloud → IAM, give the service-account email
  shown there the **Cloud Datastore User** role. That's a job for the Nibble owner)
- At least one package

### 9. Packages, then test purchases
1. Admin → Premium → **Packages**. The default **Yearly · $5 / year** is there: click **Edit →
   Save package** once so it's created in Stripe. Add others if wanted.
2. Switch on **Offer Premium in the app**.
3. In the Nibble app (meetnibble.com/app) → **Premium** → **Get Premium**. Use a Nibble account with
   a **verified, normal email address** (temporary emails are refused on purpose).
4. Test cards (any future date, any CVC, any postcode):

   | Card | What it tests | What should happen |
   |---|---|---|
   | `4242 4242 4242 4242` | normal payment | Premium on within seconds; subscriber listed in Admin |
   | `4000 0025 0000 3155` | 3-D Secure | asks to confirm, then works |
   | `4000 0000 0000 9235` | elevated Radar risk | payment works, Radar marks it (review rule) |
   | `4100 0000 0000 0019` | blocked by Radar | payment refused |
   | `4000 0000 0000 0259` | dispute | Premium ends, subscription cancelled, account flagged in Admin → Premium → Disputes |
   | `4000 0000 0000 5423` | early fraud warning | payment refunded, Premium ends, account flagged |

5. In Stripe → the payment → the customer: check the `nb_…` metadata fields, the billing address
   and "Agreed to terms".
6. Stripe → Developers → Webhooks → the endpoint → **Resend** one event: Admin → Premium →
   Webhook log shows it wasn't processed twice.
7. Optional: Admin → Premium → **Promotion codes**, create `TEST50`, and try it on the payment page.

### Testing on your own computer (optional)
Install the Stripe CLI, put test keys in `.env.local` (never commit it), then:
```
stripe listen --forward-to localhost:3000/api/stripe/webhook   # prints a whsec_… for .env.local
npm run dev
stripe trigger checkout.session.completed
```

---

## Part 2: going live

Test-mode keys, webhooks, prices, coupons and customers **don't carry over** to live mode, so
repeat in live mode:

1. Check Part 0 is done and the website pages are live.
2. Stripe → switch **Test mode off**. Finish account activation (business details exactly as in
   Part 0, bank account for payouts).
3. Create the **live restricted key** with the same permissions.
4. Create the **live webhook endpoint** with the same URL, API version and 15 events; copy its live
   `whsec_…` secret.
5. Save the **customer portal**, **emails** and **Radar rules** in live mode.
6. Vercel: replace `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with the live values →
   **Redeploy**.
7. Admin → Premium → **Re-check** (should say **LIVE**). Then **Edit → Save** each package again so
   live prices are created (the test price IDs don't exist in live mode).
8. Make one real purchase with your own card, then refund it from Admin → Premium → Disputes &
   fraud warnings → Refund a payment.

## Good to know
- **Refunds:** our policy is a full refund within 14 days of any payment. Paste the payment id
  (`ch_…` or `py_…`, from Stripe → Payments) into Admin → Premium → Refund a payment. A full refund
  ends that person's Premium automatically.
- **Disputes / fraud warnings:** Premium ends and the account is flagged (it can't buy again). Look
  at the payment in Stripe, respond to the dispute there if you want to fight it, then **Clear** the
  flag in Admin if the person is fine.
- **Stopping a subscription:** Admin → Premium → Subscribers → Cancel (at period end) or End now.
- Stripe fees are about 2.9% + 30¢ per payment ($5 → about $4.55). Look at **Stripe Tax** before
  selling to places that need sales tax / VAT.
- Changing a price creates a new Stripe price; people already subscribed keep paying the old one.
  Tell subscribers at least 30 days before (the terms promise this).
- **Rotating the secret key:** create a new restricted key, update it in Vercel, redeploy, then
  delete the old key.
- **Rotating the webhook secret without downtime:** in Stripe, roll the endpoint's secret (keep the
  old one active for a while), set `STRIPE_WEBHOOK_SECRET` to `new_secret,old_secret`, redeploy,
  and once the old one expires set it to just the new one.
- If the webhook shows failures (Stripe → Developers → Webhooks → the endpoint, or Admin → Premium →
  Webhook log), check that `STRIPE_WEBHOOK_SECRET` matches **that** endpoint's signing secret
  (test and live differ) and that you redeployed after changing it.
