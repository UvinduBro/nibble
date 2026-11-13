// "About" — how Nibble started, and the two people behind it.
const PEOPLE = [
  {
    name: 'Uvindu Rajapakshe',
    role: 'Concept, design & code',
    img: '/team/uvindu.jpg',
    bio: 'Founder of Devs.lk, senior creative designer, digital content creator and developer.',
    tag: 'creator',
  },
  {
    name: 'Wageesha Ruvangi',
    role: 'Behind the project',
    img: '/team/wageesha.jpg',
    bio: 'The spark behind Nibble Social. She imagined friends’ pets visiting each other, tested every build, and wrote the wishlist that became reminders, pet interactions and sounds.',
    tag: 'co-creator',
  },
];

export default function About() {
  return (
    <>
      <div className="about-story reveal">
        <p>
          Nibble started as a tiny personal project. <b>Uvindu</b> wanted a little companion on his own Windows desktop:
          something that walks along title bars, hops between windows, and keeps him company while he designs and codes.
          So he drew one, gave it physics, and let it loose.
        </p>
        <p>
          Then <b>Wageesha</b> met it and asked the question that changed everything: <em>“What if our pets could visit each other?”</em>{' '}
          That became Nibble Social: accounts, friends, pets that walk onto each other’s screens, and little messages.
          She kept testing and kept sending ideas. Deadline reminders, pets that cuddle, squabble and share ice cream,
          and soft sounds all came from her notes, and now you can even listen to music together.
        </p>
        <p className="about-sign">What began as one pet on one desktop is now a little crew that connects friends. Made in Sri Lanka, with love. 🐾</p>
      </div>
      <div className="about-cards">
        {PEOPLE.map((p) => (
          <article key={p.name} className="about-card reveal">
            <div className="glitch">
              <img src={p.img} alt={p.name} loading="lazy" width={720} height={960} />
              <span className="about-tag">{p.tag}</span>
            </div>
            <div className="about-body">
              <h3>{p.name}</h3>
              <span className="about-role">{p.role}</span>
              <p>{p.bio}</p>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
