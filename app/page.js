import PetFigure from '../components/PetFigure';
import StoreBadges from '../components/landing/StoreBadges';
import OldAnchors from '../components/landing/OldAnchors';
import { SitePage, Rise, Head, HubMock, Reviews, PillarsSection, PricingSection, BlogSection, FinalSection, jsonLd } from '../components/landing/HomeParts';
import { approvedReviews } from '../lib/reviews';
import { getPlan } from '../lib/billing';
import { buyable } from '../lib/premium';
import release from '../public/version.json';
import './landing.css';

// Home: a short tour. The details live on their own pages (/features, /pets, /download, /faq, /contact, /pricing, /blog).
const TOUR = [
  ['/features', 'It walks on your windows', 'Naps when you leave, reacts to your apps, reminds you to take breaks.', '/blog/desktop-demo.webp', 'Pets walking on open windows'],
  ['/pets', 'Animals, characters and outfits', '12 animals, the original Nibble and an anime crew of 8. Dress them in any colour.', '/blog/characters.webp', 'The Nibble character picker'],
  ['/blog/desktop-pet-with-friends', 'Friends’ pets visit you', 'Talk through your pets, send hugs and pokes, make groups.', '/blog/hero-friends.webp', 'Two pets chatting'],
  ['/blog/listen-to-music-together-online', 'Listen to music together', 'YouTube and Spotify rooms where everyone hears the same second.', '/blog/hero-music.webp', 'A Listen Together player'],
  ['/blog/free-mini-games-on-your-desktop', '14 mini games', 'Pool, Ludo, Block Blast and more. Earn points for your pet.', '/blog/game-pool.webp', 'A game of Pet Pool'],
  ['/pricing', 'Free, no ads', 'Every feature is free. Premium adds a few extras if you want them.', '/blog/app-customize.webp', 'Customizing a pet'],
];

export default async function Home() {
  const [reviews, plan] = await Promise.all([approvedReviews(), getPlan({ revalidate: 300 })]);
  // Premium prices go in the structured data only while Premium is really on sale
  const premium = plan.enabled ? buyable(plan) : [];
  return (
    <SitePage ld={jsonLd(reviews, premium)}>
      <OldAnchors />
      <section className="lp-hero">
        <div className="lp-hero-glow" aria-hidden />
        <div className="lp-wrap">
          <a href="/download" className="lp-pill"><span className="chip is-new">New</span>Now on the Microsoft Store · Version {release.version}</a>
          <Rise text="Free desktop pet for Windows and Mac" />
          <p className="lp-sub rise-sub"><strong>Nibble is a cute desktop pet that walks on your windows</strong>, naps when you’re away, plays music with your friends and visits their screens to say hi.</p>
          <div className="rise-sub"><StoreBadges /></div>
        </div>
        <div className="lp-wrap lp-mock" data-reveal>
          <div className="lp-perch p1" aria-hidden><PetFigure skin="mint" mood="wave" w={110} h={100} size={0.95} /></div>
          <div className="lp-perch p2" aria-hidden><PetFigure skin="mojo" mood="dance" w={100} h={96} size={0.85} /></div>
          <HubMock />
        </div>
      </section>

      <PillarsSection />

      <section className="lp-sec" id="tour">
        <div className="lp-wrap">
          <Head kicker="Take a look" title="Everything Nibble does, at a glance." sub="Tap any card for the details." />
          <ul className="lp-tour">
            {TOUR.map(([href, t, d, img, alt], i) => (
              <li key={href} data-reveal style={{ '--d': `${(i % 3) * 0.06}s` }}>
                <a href={href}>
                  <img src={img} alt={alt} loading="lazy" />
                  <h3>{t}</h3>
                  <p>{d}</p>
                  <span aria-hidden>Learn more →</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {reviews.length > 0 && <Reviews list={reviews} />}
      <PricingSection plan={plan} />
      <BlogSection />
      <FinalSection />
    </SitePage>
  );
}
