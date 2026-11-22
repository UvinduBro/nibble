import LegalPage from '../../components/landing/LegalPage';
import { pageMetadata } from '../../lib/seo';
import { SELLER } from '../../lib/facts';

export function generateMetadata() {
  return pageMetadata('privacy', '/privacy');
}

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="21 November 2026">
      <p>Nibble is a desktop pet app made by Uvindu Rajapakshe and Wageesha Ruvangi in Colombo, Sri Lanka, and operated by {SELLER.name} ({SELLER.address}). This page explains what we collect, why, and how to get it removed. We don’t sell your data and we don’t show ads.</p>

      <h2>Using Nibble without an account</h2>
      <p>The desktop pet works on its own. Your pets and settings are saved on your computer. If you don’t sign in, nothing about you is sent to us, apart from the normal request your app makes to check for updates.</p>

      <h2>What we store when you sign in</h2>
      <ul>
        <li><strong>Account:</strong> your email address (or Google account) to sign you in, your username, and your pet’s name and look.</li>
        <li><strong>Sign-up answers:</strong> how you found Nibble, your country, and what you’d like to use it for.</li>
        <li><strong>Friends and social features:</strong> your friend list, whether you’re online, your status, short messages and actions you send (messages disappear after 30 minutes), music rooms you join, and shared reminders.</li>
        <li><strong>Your own lists:</strong> deadlines and “about me” details. Only you can read them.</li>
        <li><strong>Points:</strong> your points, unlocked items and best game scores.</li>
        <li><strong>Which app you use:</strong> desktop or web, and the version number, so we can help with problems.</li>
      </ul>
      <p>The names of the apps on your computer are used by your pet to react to what you’re doing. They stay on your computer and are never sent to us or to your friends.</p>

      <h2>Bug reports, feedback and contact messages</h2>
      <p>When you send us a bug report, feedback or a message, we store what you write, any screenshot you add, your Nibble version and system, and the email or username you give us so we can reply.</p>

      <h2>Premium payments and fraud prevention</h2>
      <p>If you buy Nibble Premium, Stripe processes the payment. You give your card and billing address to Stripe on its own page; we never see your card number. To protect you and us from stolen cards and payment fraud, we also send Stripe some details about your Nibble account when you start a payment:</p>
      <ul>
        <li>your user id and username, when your account was created, how you sign in, and the domain of your email address;</li>
        <li>the country you picked at sign-up and how you found Nibble, plus your points total and streak;</li>
        <li>the country, region and city your connection comes from, and a one-way scrambled code for your network (not your IP address);</li>
        <li>your browser or app version, language, time zone and screen size;</li>
        <li>whether you’ve had Premium before and how many times you’ve opened the payment page recently.</li>
      </ul>
      <p>Stripe uses this, together with what it sees itself, to spot fraud (see <a href="https://stripe.com/privacy" target="_blank" rel="noreferrer">Stripe’s privacy policy</a>). We keep records of payment events for 90 days, and records of disputes and refunds while your account exists. We don’t allow temporary (throwaway) email addresses to buy Premium.</p>

      <h2>Emails</h2>
      <p>We send emails through Resend, from no-reply@meetnibble.com. You only get news and updates if you sign up (the box on the website, or “Email me news and updates” in the app’s Settings). Every news email has an unsubscribe link, and you can also switch it off in Settings. We may also email you directly to answer a message or bug report you sent us.</p>

      <h2>Website analytics</h2>
      <p>If you click OK on the cookie banner, we use Google Analytics to count visits and downloads and see which pages people use. If you choose “No thanks”, it never loads. You can change your mind by clearing this site’s data in your browser.</p>

      <h2>Who processes your data</h2>
      <ul>
        <li><strong>Google Firebase</strong> stores accounts and app data.</li>
        <li><strong>Vercel</strong> hosts this website.</li>
        <li><strong>Resend</strong> sends our emails, and keeps the news list if you sign up.</li>
        <li><strong>Stripe</strong> handles Premium payments and fraud checks. Your card details go straight to Stripe; we keep whether you have Premium and until when, your Stripe customer id, and any disputes or refunds.</li>
        <li><strong>GitHub</strong> hosts the app downloads.</li>
        <li><strong>Google Analytics</strong>, only if you agree to it.</li>
      </ul>
      <p>These services may store data outside your country, including in the United States.</p>

      <h2>How long we keep it</h2>
      <p>Account data stays while your account exists. Messages delete themselves after 30 minutes, and finished reminders after a day. Reports and contact messages are kept until we’ve dealt with them.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Use “Appear offline” or “Do not disturb” in Settings to stop sharing that you’re online.</li>
        <li>Delete your account any time in the app: Settings → Delete account. It removes your profile, friends, messages, points and posts straight away (<a href="/delete-account">more about deleting</a>).</li>
        <li>To get a copy of your data, write to us using the <a href="/#contact">contact form</a>. We’ll do it within 30 days.</li>
      </ul>

      <h2>Children</h2>
      <p>Nibble isn’t meant for children under 13, and we don’t knowingly create accounts for them. If you think a child has an account, contact us and we’ll delete it.</p>

      <h2>Changes</h2>
      <p>If we change this policy we’ll update the date at the top, and tell signed-in users about big changes in the app.</p>

      <h2>Contact</h2>
      <p>Questions about privacy? Use the <a href="/#contact">contact form</a> or email <a href={'mailto:' + SELLER.email}>{SELLER.email}</a>. {SELLER.name}, {SELLER.address}.</p>
    </LegalPage>
  );
}
