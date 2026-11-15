import LegalPage from '../../components/landing/LegalPage';

export const metadata = {
  title: 'Terms of use',
  description: 'The simple rules for using Nibble.',
  alternates: { canonical: '/terms' },
};

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="15 November 2026">
      <p>By downloading Nibble or creating an account, you agree to these terms. They’re short, so please read them.</p>

      <h2>Nibble is free</h2>
      <p>The app, the pets, the games and the social features are free. Points are earned by playing and can’t be bought or exchanged for money.</p>

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

      <h2>Contact</h2>
      <p>Questions? Use the <a href="/#contact">contact form</a>.</p>
    </LegalPage>
  );
}
