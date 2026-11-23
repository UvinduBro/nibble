// Renders a blog article's blocks (lib/blog.js). Server component: plain HTML, no client JS.
import { headingId } from '../../lib/blog';

// **bold** and [label](/link) → React nodes
export function Inline({ text }) {
  const out = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, m, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={k++}>{m[1]}</strong>);
    else {
      const href = m[3];
      const ext = /^https?:\/\//.test(href);
      out.push(<a key={k++} href={href} {...(ext ? { target: '_blank', rel: 'noopener' } : {})}>{m[2]}</a>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Blocks({ blocks, cta }) {
  return blocks.map((b, i) => {
    const [t] = b;
    if (t === 'p') return <p key={i}><Inline text={b[1]} /></p>;
    if (t === 'h2') return <h2 key={i} id={headingId(b[1])}><Inline text={b[1]} /></h2>;
    if (t === 'h3') return <h3 key={i}><Inline text={b[1]} /></h3>;
    if (t === 'ul') return <ul key={i}>{b[1].map((x, j) => <li key={j}><Inline text={x} /></li>)}</ul>;
    if (t === 'ol') return <ol key={i}>{b[1].map((x, j) => <li key={j}><Inline text={x} /></li>)}</ol>;
    if (t === 'tip') return <aside key={i} className="bl-tip"><span aria-hidden>💡</span><p><Inline text={b[1]} /></p></aside>;
    if (t === 'img') {
      const [, src, alt, caption, wide] = b;
      return (
        <figure key={i} className={'bl-fig' + (wide ? ' wide' : '')}>
          <img src={src} alt={alt} loading={i < 4 ? 'eager' : 'lazy'} decoding="async" />
          {caption && <figcaption>{caption}</figcaption>}
        </figure>
      );
    }
    if (t === 'qa') {
      return (
        <section key={i} className="bl-qa" aria-label="Questions">
          <h2 id="questions">Quick questions</h2>
          {b[1].map(([q, a]) => (
            <details key={q} open>
              <summary>{q}</summary>
              <p><Inline text={a} /></p>
            </details>
          ))}
        </section>
      );
    }
    if (t === 'cta') return <div key={i}>{cta}</div>;
    return null;
  });
}
