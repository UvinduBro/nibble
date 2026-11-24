import LegalPage from '../../components/landing/LegalPage';
import Seller from '../../components/landing/Seller';
import { pageMetadata } from '../../lib/seo';
import { REFUND_DAYS, SELLER } from '../../lib/facts';

export function generateMetadata() {
  return pageMetadata('terms', '/terms');
}

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="21 November 2026">
      <p>By downloading Nibble or creating an account, you agree to these terms. They’re short, so please read them. Nibble is operated by {SELLER.name} (“we”, “us”).</p>

      <h2>Nibble is free</h2>
      <p>The app, the pets, the games and the social features are free. Points are earned by playing and can’t be bought or exchanged for money.</p>

      <h2>Nibble Premium (optional)</h2>
      <p>Premium is an optional subscription with a few extras, like a badge, a bigger daily bonus and bigger music rooms. Everything else stays free. Premium is sold by <b>{SELLER.name}</b>. Current prices are on the <a href="/pricing">pricing page</a>, and the exact price is shown before you pay. Payments are handled by Stripe; we never see or store your card.</p>
      <ul>
        <li><b>Automatic renewal.</b> Premium renews at the end of each billing period (weekly, monthly or yearly, as you chose) and your payment method is charged, until you cancel.</li>
        <li><b>Cancelling.</b> Cancel any time from the app (Premium → Manage subscription) or by emailing us. You keep Premium until the end of the period you paid for and aren’t charged again.</li>
        <li><b>Refunds.</b> You can get a full refund within {REFUND_DAYS} days of any payment. Details are in the <a href="/refunds">refund policy</a>.</li>
        <li><b>Free trials.</b> Some plans include a free trial for first-time members. A payment method is needed to start one. If you don’t cancel before the trial ends, the subscription starts and you’re charged.</li>
        <li><b>Price changes.</b> We’ll tell you at least 30 days before a price change. It applies from your next renewal, and you can cancel before then.</li>
        <li><b>Taxes.</b> Prices may include, or have added, sales tax or VAT where the law requires it.</li>
        <li><b>Failed payments.</b> If a renewal can’t be charged, Stripe tries again for a short while. If it still fails, Premium ends.</li>
        <li><b>Chargebacks and suspensions.</b> If a payment is disputed with your bank, or an account is suspended for breaking these terms, Premium on that account ends. We still refund within the {REFUND_DAYS}-day window, and we always refund billing mistakes.</li>
        <li><b>Payment fraud.</b> To stop fraud, we share some account details with Stripe when you pay (see the <a href="/privacy">privacy policy</a>) and we may refuse or cancel a purchase that looks fraudulent.</li>
      </ul>

      <h2>Your account</h2>
      <ul>
        <li>You need to be at least 13 to create an account.</li>
        <li>Keep your sign-in details safe. You’re responsible for what happens on your account.</li>
        <li>Pick a username that isn’t offensive and doesn’t pretend to be someone else.</li>
      </ul>

      <h2>Be kind</h2>
      <p>Don’t use Nibble to harass, threaten or spam people, or to send anything hateful, sexual or illegal. Don’t try to break, overload or cheat the service, including the points system. We can pause or remove accounts that break these rules.</p>

      <h2>Music</h2>
      <p>Listen together plays songs through YouTube and Spotify’s own players. Their terms apply to that content, and we don’t host any music.</p>

      <h2>The app</h2>
      <p>Nibble is provided as it is. We work hard to keep it running well, but we can’t promise it will always be available or free of bugs. We may change, pause or stop features at any time. As far as the law allows, we aren’t responsible for losses from using the app.</p>

      <h2>Nibble’s name and art</h2>
      <p>The Nibble name, pets, characters and artwork belong to us. Please don’t copy them for other products without asking.</p>

      <h2>Changes</h2>
      <p>We may update these terms. If the change is important we’ll tell you in the app. Continuing to use Nibble means you accept the new terms.</p>

      <h2>Law</h2>
      <p>These terms are governed by the laws of the State of Missouri, USA. This doesn’t take away any rights you have under the consumer laws of the country you live in.</p>

      <h2>Contact</h2>
      <p>Questions? Use the <a href="/contact">contact form</a> or email <a href={'mailto:' + SELLER.email}>{SELLER.email}</a>.</p>
      <Seller />
    </LegalPage>
  );
}
