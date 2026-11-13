// "About" — the idea behind Nibble, and the two people behind it.
const PEOPLE = [
  {
    name: 'Uvindu Rajapakshe',
    role: 'Concept, design & code',
    img: '/team/uvindu.jpg',
    tag: 'creator',
    social: { linkedin: 'https://www.linkedin.com/', instagram: 'https://www.instagram.com/', facebook: 'https://www.facebook.com/' },
  },
  {
    name: 'Wageesha Ruvangi',
    role: 'Behind the project',
    img: '/team/wageesha.jpg',
    tag: 'co-creator',
    social: { linkedin: 'https://www.linkedin.com/', instagram: 'https://www.instagram.com/', facebook: 'https://www.facebook.com/' },
  },
];

const ICONS = {
  linkedin: 'M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z',
  instagram: 'M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.63-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-11.85a1.44 1.44 0 1 0 0 2.88 1.44 1.44 0 0 0 0-2.88z',
  facebook: 'M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z',
};
const LABEL = { linkedin: 'LinkedIn', instagram: 'Instagram', facebook: 'Facebook' };

export default function About() {
  return (
    <>
      <div className="about-story reveal">
        <p>
          Nibble is a tiny companion that lives on your desktop. It walks along the tops of your windows, hops between them,
          naps on the taskbar and reacts to what you’re doing, so your screen feels a little less lonely while you work.
        </p>
        <p>
          The idea grew from one pet into a small social world: friends’ pets can visit each other, deliver messages, cuddle,
          squabble and make up over ice cream, remind you about deadlines, play games and even listen to music together.
        </p>
        <p className="about-sign">Designed and built in Sri Lanka.</p>
      </div>
      <div className="about-cards">
        {PEOPLE.map((p) => (
          <article key={p.name} className="about-card reveal">
            <div className="glitch">
              <img src={p.img} alt={p.name} loading="lazy" />
              <span className="gl gl-a" style={{ backgroundImage: `url(${p.img})` }} aria-hidden="true" />
              <span className="gl gl-b" style={{ backgroundImage: `url(${p.img})` }} aria-hidden="true" />
              <span className="gl-scan" aria-hidden="true" />
              <span className="about-tag">{p.tag}</span>
            </div>
            <div className="about-body">
              <h3>{p.name}</h3>
              <span className="about-role">{p.role}</span>
              <div className="about-social">
                {Object.keys(p.social).map((k) => (
                  <a key={k} href={p.social[k]} target="_blank" rel="noopener noreferrer" aria-label={`${p.name} on ${LABEL[k]}`} title={LABEL[k]}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d={ICONS[k]} /></svg>
                  </a>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
