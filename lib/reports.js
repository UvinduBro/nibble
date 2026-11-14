// Bug reports and feedback: reports/{id}. Shared by the Hub (Firebase SDK, signed in) and the
// website (/api/feedback, anonymous). The Firestore rules check the same shape.
export const REPORT_CATS = ['like', 'dislike', 'feature', 'idea', 'problem', ''];
export const REPORT_STATUS = ['new', 'seen', 'done'];
const cut = (s, n) => String(s == null ? '' : s).replace(/\u0000/g, '').trim().slice(0, n);

export function cleanReport(r = {}, who = {}) {
  const kind = r.kind === 'feedback' ? 'feedback' : 'bug';
  const shot = typeof r.shot === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(r.shot) && r.shot.length <= 700_000 ? r.shot : '';
  const out = {
    kind,
    cat: kind === 'feedback' && REPORT_CATS.includes(r.cat) ? r.cat : '',
    title: cut(r.title, 80),
    what: cut(r.what, 1000), doing: cut(r.doing, 1000), expected: cut(r.expected, 1000), actual: cut(r.actual, 1000),
    text: cut(r.text, 2000),
    contact: cut(r.contact, 100),
    shot,
    ver: cut(r.ver, 16), os: cut(r.os, 40), client: cut(r.client, 16), page: cut(r.page, 80),
    uid: cut(who.uid, 40), username: cut(who.username, 20),
    status: 'new',
  };
  return out;
}

export const reportId = (uid = '') => (uid ? uid.slice(0, 6) : 'anon') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
