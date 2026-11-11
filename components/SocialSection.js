'use client';
import PetFigure from './PetFigure';
import './social-section.css';

const POINTS = [
  ['🔑', 'Sign in your way', 'Google or email and password. Pick a username like @wagee and you’re in.'],
  ['🤝', 'Add friends by username', 'Send a request or share your link. They accept, and you’re connected.'],
  ['🐾', 'Their pets visit you', 'When a friend is online, their pet drops onto your desktop with a little name tag and walks your windows too.'],
  ['💭', 'Hold to talk', 'Click and hold your pet, release, and type up to 80 characters. Friends see a thinking cloud while you type, then your words pop out of your pet.'],
  ['👉', 'Poke, wave, whisper', 'Double-click a friend’s pet to poke it. Hold it to whisper just to them. Right-click for waves, hearts, high fives and snacks.'],
  ['🎛️', 'The Nibble Hub', 'A proper app window for your account, friends, messages, pets and every setting. Double-click the tray icon.'],
];

export default function SocialSection() {
  return (
    <div className="soc">
      <div className="soc-stage reveal">
        <div className="soc-pet">
          <span className="soc-think"><i /><i /><i /></span>
          <PetFigure skin="hikari" mood="work" w={150} h={140} />
          <b>@wagee</b>
        </div>
        <div className="soc-pet">
          <span className="soc-say">ship it!! 🚀</span>
          <PetFigure skin="mojo" mood="dance" w={150} h={150} />
          <b>@uvindu</b>
        </div>
        <div className="soc-pet">
          <span className="soc-say small">👉 poke</span>
          <PetFigure skin="kumo" mood="happy" w={150} h={140} />
          <b>@kasun</b>
        </div>
      </div>
      <div className="features soc-grid">
        {POINTS.map(([i, t, d]) => (
          <div key={t} className="feat reveal"><div className="soc-ico">{i}</div><h3>{t}</h3><p>{d}</p></div>
        ))}
      </div>
      <div className="hero-cta soc-cta">
        <a href="/app" className="btn">Open Nibble Social in your browser</a>
        <a href="#download" className="btn ghost">Get the desktop app</a>
      </div>
    </div>
  );
}
