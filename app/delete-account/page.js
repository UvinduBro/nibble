import LegalPage from '../../components/landing/LegalPage';
import { SELLER } from '../../lib/facts';

export const metadata = {
  title: 'Delete your Nibble account',
  description: 'How to delete your Nibble account and data, from the app, the website or by email.',
  alternates: { canonical: '/delete-account' },
};

// Google Play asks for a web page that explains how to delete an account (Data safety form).
export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your Nibble account" updated="22 November 2026">
      <p>You can delete your Nibble account at any time. It takes a few seconds and can’t be undone.</p>

      <h2>In the app or on the website</h2>
      <ol>
        <li>Open the Nibble app on your phone or computer, or sign in at <a href="/app">meetnibble.com/app</a>.</li>
        <li>Go to <b>Settings</b> and scroll to <b>Delete account</b>.</li>
        <li>Choose <b>Delete my account…</b>, type <b>DELETE</b> and confirm.</li>
      </ol>
      <p>If it asks you to sign in again first, sign out, sign back in and delete straight away. That keeps other people from deleting your account on a shared device.</p>

      <h2>By email</h2>
      <p>Can’t sign in? Email <a href={'mailto:' + SELLER.email}>{SELLER.email}</a> from the address on your account and include your @username. We delete it within 30 days.</p>

      <h2>What’s deleted</h2>
      <ul>
        <li>Your sign-in account, username and profile, and your pet’s looks</li>
        <li>Friends, friend requests, messages and reminders</li>
        <li>Points, items you unlocked and game scores</li>
        <li>Groups you own (you leave the others), and your Tea Room posts and comments</li>
        <li>Your review of Nibble and your sign-up answers</li>
      </ul>

      <h2>What we keep</h2>
      <ul>
        <li>If you paid for Premium: payment records (amount, date, Stripe ids), which tax and fraud rules require us to keep. They don’t include your profile, friends or messages.</li>
        <li>Bug reports and contact messages until we’ve dealt with them.</li>
      </ul>
      <p>An active Premium subscription is cancelled when you delete your account, so you won’t be charged again.</p>
    </LegalPage>
  );
}
