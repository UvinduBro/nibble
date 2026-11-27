// Replies in private and group chats: a ↩ button on a message, a "Replying to" bar above the
// input, and the quoted message shown inside the reply.
export function ReplyBtn({ onClick }) {
  return <button type="button" className="rp-btn" title="Reply" aria-label="Reply" onClick={onClick}>↩</button>;
}

export function Quote({ re, mine }) {
  if (!re || !re.t) return null;
  return <span className={'rp-quote' + (mine ? ' mine' : '')}><b>{re.n ? '@' + re.n : 'Message'}</b>{re.t}</span>;
}

export function ReplyBar({ re, onClose }) {
  if (!re) return null;
  return (
    <div className="rp-bar">
      <span><small>Replying to {re.n ? '@' + re.n : 'yourself'}</small>{re.t}</span>
      <button type="button" aria-label="Cancel reply" onClick={onClose}>✕</button>
    </div>
  );
}
