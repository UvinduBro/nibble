import LegalPage from '../../components/landing/LegalPage';
import Seller from '../../components/landing/Seller';
import { pageMetadata } from '../../lib/seo';
import { getPlan } from '../../lib/billing';
import PriceCards, { planView } from '../../components/landing/PriceCards';
import { REFUND_DAYS, SELLER, ldJson, crumbsLd } from '../../lib/facts';

// the plan comes from config/premium; cached for 5 minutes so the page stays fast and cheap
export const revalidate = 300;

export function generateMetadata() {
  return pageMetadata('pricing', '/pricing');
}


export default async function Pricing() {
  const plan = await getPlan({ revalidate: 300 });
  const { shown } = planView(plan);
  return (
    <LegalPage title="Pricing" wide>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(crumbsLd([['Pricing', 'https://meetnibble.com/pricing']])) }} />
      <p>Nibble is free, with no ads. {plan.name} is an optional subscription that adds a few extras and helps keep Nibble free for everyone.</p>

      <PriceCards plan={plan} />
      <p className="lp-fine">Prices are in {shown[0] ? String(shown[0].currency).toUpperCase() : 'USD'}. Sales tax or VAT may be added at checkout where the law requires it.</p>

      <h2>How billing works</h2>
      <ul>
        <li><b>Renews automatically.</b> Premium renews at the end of each billing period at the price shown when you subscribed, until you cancel. You’ll see the exact price and renewal date before you pay.</li>
        <li><b>Cancel any time.</b> In the Nibble app, open <b>Premium → Manage subscription</b>. You keep Premium until the end of the period you paid for and you won’t be charged again.</li>
        <li><b>{REFUND_DAYS}-day refund.</b> Changed your mind? We give a full refund within {REFUND_DAYS} days of any payment, first one or renewal. See the <a href="/refunds">refund policy</a>.</li>
        <li><b>Price changes</b> are announced at least 30 days ahead and only apply from your next renewal.</li>
        <li><b>Secure payments.</b> Payments are handled by Stripe. We never see or store your card number. The charge on your card statement shows as Nibble (meetnibble.com).</li>
        <li><b>Points can’t be bought.</b> ⭐ points are only earned by playing; Premium never sells points or game items.</li>
      </ul>

      <h2>Questions</h2>
      <p>Write to <a href={'mailto:' + SELLER.email}>{SELLER.email}</a> or use the <a href="/contact">contact form</a>. We usually reply within 2 business days. See also the <a href="/terms">terms of use</a> and <a href="/privacy">privacy policy</a>.</p>
      <Seller />
    </LegalPage>
  );
}
