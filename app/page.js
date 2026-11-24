import PetFigure from '../components/PetFigure';
import StoreBadges from '../components/landing/StoreBadges';
import OldAnchors from '../components/landing/OldAnchors';
import { SitePage, Rise, Head, Reviews, PricingSection, FinalSection, jsonLd } from '../components/landing/HomeParts';
import { approvedReviews } from '../lib/reviews';
import { getPlan } from '../lib/billing';
import { buyable } from '../lib/premium';
import { FOUNDERS } from '../lib/facts';
import release from '../public/version.json';
import './landing.css';

// Home: a short, friendly tour. Details live on /features, /pets, /download, /faq, /contact, /pricing, /blog, /about.

// the crew row: [skin, name, mood]
const CREW = [['mint', 'Nibble', 'idle'], ['mojo', 'Mojo', 'jump'], ['hikari', 'Hikari', 'sit'], ['kumo', 'Kumo', 'idle'], ['peach', 'Mochi', 'sit'], ['yuki', 'Yuki', 'idle'], ['volt', 'Volt', 'jump'], ['goldie', 'Nugget', 'sit']];

// tour cards: [href, title, text, image, alt, tint]
const TOUR = [
  ['/features', 'It walks on your windows', 'Naps when you leave, reacts to your apps and reminds you to take breaks.', '/blog/desktop-demo.webp', 'Pets walking on open windows', 'mint'],
  ['/pets', 'Animals, characters, outfits', '12 animals, the original Nibble and an anime crew of 8. Dress them in any colour.', '/blog/characters.webp', 'The Nibble character picker', 'pink'],
  ['/blog/desktop-pet-with-friends', 'Friends’ pets visit you', 'Talk through your pets, send hugs and pokes, make groups.', '/blog/hero-friends.webp', 'Two pets chatting', 'lav'],
  ['/blog/listen-to-music-together-online', 'Music, together', 'YouTube and Spotify rooms where everyone hears the same second.', '/blog/hero-music.webp', 'A Listen Together player', 'butter'],
  ['/blog/free-mini-games-on-your-desktop', '14 little games', 'Pool, Ludo, Block Blast and more. Earn points for your pet.', '/blog/game-pool.webp', 'A game of Pet Pool', 'sky'],
  ['/pricing', 'Free, no ads', 'Everything is free. Premium adds a few extras if you want them.', '/blog/app-customize.webp', 'Customizing a pet', 'peach'],
];

function Stage() {
  return (
    <div className="hc-stage" aria-hidden>
      <div className="hc-win w1">
        <div className="hc-bar"><i /><i /><i /><span>notes.txt</span></div>
        <div className="hc-body"><b /><b /><b className="s" /><b /></div>
        <div className="hc-perch p1"><span className="hc-say">hi! I live up here ✨</span><PetFigure skin="mint" mood="idle" w={104} h={96} size={0.9} /></div>
      </div>
      <div className="hc-win w2">
        <div className="hc-bar"><i /><i /><i /><span>weekend playlist</span></div>
        <div className="hc-body hc-eq"><u /><u /><u /><u /><u /><u /><u /></div>
        <div className="hc-perch p2"><PetFigure skin="mojo" mood="jump" w={96} h={92} size={0.82} /></div>
      </div>
      <div className="hc-win w3">
        <div className="hc-bar"><i /><i /><i /><span>code.js</span></div>
        <div className="hc-body hc-code"><b /><b className="s" /><b /><b className="s" /></div>
        <div className="hc-perch p3"><PetFigure skin="kumo" mood="work" w={92} h={88} size={0.78} /></div>
      </div>
      <div className="hc-task"><span className="hc-zz">z z z</span><PetFigure skin="hikari" mood="sleep" w={84} h={76} size={0.72} /></div>
    </div>
  );
}

export default async function Home() {
  const [reviews, plan] = await Promise.all([approvedReviews(), getPlan({ revalidate: 300 })]);
  // Premium prices go in the structured data only while Premium is really on sale
  const premium = plan.enabled ? buyable(plan) : [];
  return (
    <SitePage ld={jsonLd(reviews, premium)}>
      <OldAnchors />
      <section className="hc-hero">
        <div className="hc-blobs" aria-hidden><i /><i /><i /></div>
        <div className="lp-wrap hc-hero-in">
          <a href="/download" className="lp-pill"><span className="chip is-new">New</span>Now on the Microsoft Store · v{release.version}</a>
          <Rise text="Free desktop pet for Windows and Mac" />
          <p className="lp-sub rise-sub">A tiny friend that walks on your windows, naps when you’re away, plays music with your friends and pops onto their screens to say hi.</p>
          <div className="rise-sub"><StoreBadges center /></div>
        </div>
        <div className="lp-wrap"><Stage /></div>
      </section>

      <section className="lp-sec hc-crew-sec">
        <div className="lp-wrap">
          <Head kicker="Say hi to the crew" title="Pick a pet. Make it yours." sub="Every one has its own walk, voice and special move." center />
          <ul className="hc-crew">
            {CREW.map(([skin, name, mood], i) => (
              <li key={skin} style={{ '--i': i }}><PetFigure skin={skin} mood={mood} w={96} h={92} size={0.84} /><span>{name}</span></li>
            ))}
          </ul>
          <p className="hc-more"><a href="/pets" className="lp-btn ghost">Meet all the pets →</a></p>
        </div>
      </section>

      <section className="lp-sec" id="tour">
        <div className="lp-wrap">
          <Head kicker="What it does" title="Small pet, lots to do." sub="Tap a card for the details." center />
          <ul className="hc-tour">
            {TOUR.map(([href, t, d, img, alt, tint], i) => (
              <li key={href} className={'t-' + tint} data-reveal style={{ '--d': `${(i % 3) * 0.06}s` }}>
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

      <section className="lp-sec">
        <div className="lp-wrap">
          <a href="/about" className="hc-makers" data-reveal>
            <div className="hc-makers-pets" aria-hidden>
              <span><PetFigure skin="mojo" mood="idle" w={110} h={104} size={0.95} /><em>Uvi</em></span>
              <span><PetFigure skin="peach" mood="sit" w={110} h={104} size={0.95} /><em>Wagee</em></span>
            </div>
            <div>
              <span className="lp-kicker">Meet the makers</span>
              <h2>Made with love in Colombo, Sri Lanka.</h2>
              <p>Nibble is built by two friends, {FOUNDERS.map((f) => f.name).join(' and ')}. We read every message and ship new pets and fixes all the time.</p>
              <span className="lp-btn sm">Our story →</span>
            </div>
          </a>
        </div>
      </section>

      {reviews.length > 0 && <Reviews list={reviews} />}
      <PricingSection plan={plan} />
      <FinalSection />
    </SitePage>
  );
}
