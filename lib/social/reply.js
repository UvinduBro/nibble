// a reply quotes the message it answers: { n: who wrote it, t: a short snippet of it }
export const cleanReply = (re) => {
  if (!re || !re.t) return null;
  const t = String(re.t).replace(/\s+/g, ' ').trim();
  return { n: String(re.n || '').slice(0, 30), t: t.length > 60 ? t.slice(0, 59) + '…' : t };
};
// rules that don't know replies yet reject the extra field; send without it instead of failing
export const isDenied = (e) => /permission|insufficient/i.test(String((e && (e.code || e.message)) || e));
