import LegalPage from '../../components/landing/LegalPage';
import Seller from '../../components/landing/Seller';
import { pageMetadata } from '../../lib/seo';
import { REFUND_DAYS, SELLER } from '../../lib/facts';

export function generateMetadata() {
  return pageMetadata('refunds', '/refunds');
}

export default function Refunds() {
  return (
    <LegalPage title="Refunds and cancellations" updated="21 November 2026">
      <p>This policy covers Nibble Premium, the optional subscription. Everything else in Nibble is free, so there’s nothing else to refund.</p>

      <h2>{REFUND_DAYS}-day refund, no questions asked</h2>
      <p>If you’re not happy, you get a <b>full refund within {REFUND_DAYS} days of any Premium payment</b>, the first one or a renewal. You don’t need to give a reason.</p>
      <h3>How to ask</h3>
      <ol>
        <li>Email <a href={'mailto:' + SELLER.email}>{SELLER.email}</a> or use the <a href="/#contact">contact form</a>.</li>
        <li>Include your Nibble <b>@username</b> and the email address you paid with.</li>
        <li>We reply within 2 business days. The money goes back to the card or wallet you paid with, usually within 5–10 business days (your bank decides the exact timing).</li>
      </ol>
      <p>A refund ends Premium on that account straight away.</p>

      <h2>Cancelling</h2>
      <ul>
        <li>Cancel any time in the Nibble app: <b>Premium → Manage subscription → Cancel</b>. You can also ask us by email.</li>
        <li>After cancelling you keep Premium until the end of the period you already paid for, and you won’t be charged again.</li>
        <li>After the {REFUND_DAYS}-day window we don’t give partial refunds for the rest of a billing period.</li>
      </ul>

      <h2>Free trials</h2>
      <p>Some plans start with a free trial for first-time members. A card is needed to start it, and Stripe emails you before the trial ends. Cancel before the trial ends and you won’t be charged. If you forget, the {REFUND_DAYS}-day refund still applies to that first payment.</p>

      <h2>Billing mistakes</h2>
      <p>If you were charged twice, charged after cancelling, or charged the wrong amount, we always refund it in full, whenever you notice. Just tell us.</p>

      <h2>Chargebacks</h2>
      <p>Please contact us before asking your bank to reverse a charge: a refund from us is faster. If a payment is disputed with the bank, Premium on that account ends while the dispute is open.</p>

      <h2>Points and free features</h2>
      <p>⭐ points are earned by playing and can’t be bought, so they can’t be refunded or exchanged for money.</p>
      <Seller />
    </LegalPage>
  );
}
