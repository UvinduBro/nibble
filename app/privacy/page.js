import LegalPage from '../../components/landing/LegalPage';

export const metadata = {
  title: 'Privacy policy',
  description: 'What Nibble collects, why, who processes it and how to delete it.',
  alternates: { canonical: '/privacy' },
};

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="15 November 2026">
      <p>Nibble is a desktop pet app made by Uvindu Rajapakshe and Wageesha Ruvangi in Colombo, Sri Lanka. This page explains what we collect, why, and how to get it removed. We don’t sell your data and we don’t show ads.</p>

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

      <h2>Emails</h2>
      <p>We send emails through Resend, from no-reply@meetnibble.com. You only get news and updates if you sign up (the box on the website, or “Email me news and updates” in the app’s Settings). Every news email has an unsubscribe link, and you can also switch it off in Settings. We may also email you directly to answer a message or bug report you sent us.</p>

      <h2>Website analytics</h2>
      <p>If you click OK on the cookie banner, we use Google Analytics to count visits and downloads and see which pages people use. If you choose “No thanks”, it never loads. You can change your mind by clearing this site’s data in your browser.</p>

      <h2>Who processes your data</h2>
      <ul>
        <li><strong>Google Firebase</strong> stores accounts and app data.</li>
        <li><strong>Vercel</strong> hosts this website.</li>
        <li><strong>Resend</strong> sends our emails, and keeps the news list if you sign up.</li>
        <li><strong>GitHub</strong> hosts the app downloads.</li>
        <li><strong>Google Analytics</strong>, only if you agree to it.</li>
      </ul>
      <p>These services may store data outside Sri Lanka.</p>

      <h2>How long we keep it</h2>
      <p>Account data stays while your account exists. Messages delete themselves after 30 minutes, and finished reminders after a day. Reports and contact messages are kept until we’ve dealt with them.</p>

      <h2>Your choices</h2>
      <ul>
        <li>Use “Appear offline” or “Do not disturb” in Settings to stop sharing that you’re online.</li>
        <li>To get a copy of your data or delete your account, write to us using the <a href="/#contact">contact form</a>. We’ll do it within 30 days.</li>
      </ul>

      <h2>Children</h2>
      <p>Nibble isn’t meant for children under 13, and we don’t knowingly create accounts for them. If you think a child has an account, contact us and we’ll delete it.</p>

      <h2>Changes</h2>
      <p>If we change this policy we’ll update the date at the top, and tell signed-in users about big changes in the app.</p>

      <h2>Contact</h2>
      <p>Questions about privacy? Use the <a href="/#contact">contact form</a>.</p>
    </LegalPage>
  );
}
