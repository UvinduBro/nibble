# Nibble Premium: Stripe set-up guide

For whoever sets up the payment gateway. About 20 minutes. Everything happens in the **Stripe
dashboard**, **Vercel** (where meetnibble.com runs) and the **Nibble admin panel**
(https://meetnibble.com/admin → Money → Premium). Never send keys by email or chat: paste them
straight into Vercel.

What gets created:

| Where | What | Value looks like |
|---|---|---|
| Stripe | Webhook endpoint `https://meetnibble.com/api/stripe/webhook` | – |
| Vercel env | `STRIPE_SECRET_KEY` | `sk_test_…` / `sk_live_…` (or a restricted `rk_…` key) |
| Vercel env | `STRIPE_WEBHOOK_SECRET` | `whsec_…` |

Nothing else is needed: no publishable key (Nibble uses Stripe's hosted checkout page).

---

## Part 1: test mode first

### 1. Stripe account
1. Sign in at https://dashboard.stripe.com (or create the account for Nibble).
2. Turn on **Test mode** (toggle at the top right). Everything in Part 1 happens in test mode.

### 2. Secret key
1. Stripe → **Developers → API keys**.
2. Copy the **Secret key** (`sk_test_…`). Don't share it anywhere else.
3. Optional, safer: create a **restricted key** instead (Developers → API keys → Create
   restricted key) with **Write** access to: Customers, Checkout Sessions, Subscriptions, Prices,
   Products, Coupons, Promotion codes, Customer portal; and **Read** access to: Webhook
   endpoints, Account, Invoices. Use that `rk_test_…` key as the secret key.

### 3. Webhook endpoint
1. Stripe → **Developers → Webhooks → Add endpoint**.
2. Endpoint URL: `https://meetnibble.com/api/stripe/webhook`
3. API version: leave the default.
4. Select these **6 events**:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Click **Add endpoint**, then on the endpoint page click **Reveal** under **Signing secret**
   and copy it (`whsec_…`).

### 4. Customer portal (lets people cancel or change their card)
1. Stripe → **Settings → Billing → Customer portal**.
2. Turn on: cancel subscriptions (at end of billing period), update payment methods, view invoices.
3. Click **Save** (this step is required once in test mode and once in live mode).

### 5. Add the keys in Vercel
1. Vercel → project **nibble** → **Settings → Environment Variables**.
2. Add, for the **Production** environment, type **Sensitive**:
   - `STRIPE_SECRET_KEY` = the `sk_test_…` (or `rk_test_…`) key
   - `STRIPE_WEBHOOK_SECRET` = the `whsec_…` secret
3. **Redeploy**: Vercel → Deployments → latest production deployment → ⋯ → **Redeploy**
   (environment variables only apply after a new deployment).

### 6. Check it in the admin panel
https://meetnibble.com/admin → **Premium** → **Stripe set-up** → **Re-check**. Every line should
show ✓:
- Secret key in Vercel (shows TEST mode and the Stripe account name)
- Webhook signing secret in Vercel
- Webhook endpoint in Stripe (warns if an event is missing)
- Customer portal turned on
- Server can update Firestore (if not: in Google Cloud → IAM, give the service-account email
  shown there the **Cloud Datastore User** role. That's a job for the Nibble owner)
- At least one package

### 7. Packages, then a test purchase
1. Admin → Premium → **Packages**. The default **Yearly · $5 / year** is there: click **Edit →
   Save package** once so it's created in Stripe. Add others if wanted (e.g. Monthly $0.99, a
   7-day free trial, a "Best value" label).
2. Switch on **Offer Premium in the app**.
3. In the Nibble app (meetnibble.com/app) → **Premium** → **Get Premium**. Pay with the test card
   `4242 4242 4242 4242`, any future date, any CVC, any postcode.
4. You're sent back to the app and Premium switches on within a few seconds. The subscriber
   appears in Admin → Premium → Subscribers, and in Stripe → Developers → Webhooks the endpoint
   shows successful (200) deliveries.
5. Optional: Admin → Premium → **Promotion codes**, create `TEST50`, and try it on the payment page.

---

## Part 2: going live

Test-mode keys, webhooks, prices, coupons and customers **don't carry over** to live mode, so
repeat in live mode:

1. Stripe → switch **Test mode off**. Finish account activation if Stripe asks (business details,
   bank account for payouts).
2. Copy the **live** secret key (`sk_live_…`, or a live restricted key with the same permissions).
3. Create the **live webhook endpoint** with the same URL and the same 6 events; copy its live
   `whsec_…` secret.
4. Save the **customer portal** settings in live mode.
5. Vercel: replace `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` with the live values →
   **Redeploy**.
6. Admin → Premium → **Re-check** (should say **LIVE**). Then **Edit → Save** each package again so
   live prices are created (the test price IDs don't exist in live mode).
7. Make one real purchase with your own card, then refund it from Stripe → Payments if you like.

## Good to know
- Stripe fees are about 2.9% + 30¢ per payment ($5 → about $4.55). Check **Stripe Tax** if you
  need to collect sales tax / VAT.
- Refunds: Stripe → Payments → the payment → Refund. To stop someone's subscription: Admin →
  Premium → Subscribers → Cancel (at period end) or End now.
- Changing a price creates a new Stripe price; people already subscribed keep paying the old one.
- Rotating keys: create a new key in Stripe, update it in Vercel, redeploy, then delete the old key.
- If the webhook shows failures (Stripe → Developers → Webhooks → the endpoint), check that
  `STRIPE_WEBHOOK_SECRET` matches **that** endpoint's signing secret (test and live differ) and
  that you redeployed after changing it.
