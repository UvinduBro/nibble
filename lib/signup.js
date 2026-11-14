// "How did you find Nibble?" questions asked once at sign-up (signup/{uid}). Admins see totals.
export const SOURCES = [
  ['friend', '👯 A friend told me'], ['instagram', '📸 Instagram'], ['tiktok', '🎵 TikTok'], ['facebook', '📘 Facebook'],
  ['youtube', '▶️ YouTube'], ['whatsapp', '💬 WhatsApp'], ['discord', '🎮 Discord'], ['reddit', '👽 Reddit'],
  ['x', '𝕏 X (Twitter)'], ['linkedin', '💼 LinkedIn'], ['google', '🔎 Google search'], ['devslk', '💻 Devs.lk'],
  ['school', '🎓 School or university'], ['work', '🏢 At work'], ['other', '✏️ Somewhere else'],
];
export const USES = [
  ['fun', 'Just for fun'], ['friends', 'Hang out with friends'], ['study', 'Company while studying'],
  ['work', 'Company while working'], ['music', 'Listen to music together'], ['games', 'Play games'], ['reminders', 'Deadlines and reminders'],
];
const CODES = 'AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HK HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG KP MK NO OM PK PW PS PA PG PY PE PH PL PT PR QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA KR SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VA VE VN YE ZM ZW'.split(' ');

export function countries(locale = 'en') {
  let dn = null;
  try { dn = new Intl.DisplayNames([locale], { type: 'region' }); } catch {}
  return CODES.map((c) => [c, (dn && dn.of(c)) || c]).sort((a, b) => a[1].localeCompare(b[1]));
}
export const countryName = (c) => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(c) || c; } catch { return c; } };
export const flag = (c) => (/^[A-Z]{2}$/.test(c || '') ? String.fromCodePoint(...[...c].map((x) => 0x1f1a5 + x.charCodeAt(0))) : '🌍');

// best guess from the time zone, then the browser language
const TZ = {
  'Asia/Colombo': 'LK', 'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'Asia/Singapore': 'SG', 'Asia/Dubai': 'AE', 'Asia/Karachi': 'PK', 'Asia/Dhaka': 'BD',
  'Asia/Kathmandu': 'NP', 'Indian/Maldives': 'MV', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Bangkok': 'TH', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
  'Asia/Manila': 'PH', 'Asia/Jakarta': 'ID', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA', 'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
  'Europe/Rome': 'IT', 'Europe/Madrid': 'ES', 'Europe/Amsterdam': 'NL', 'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Pacific/Auckland': 'NZ',
  'America/Toronto': 'CA', 'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Sao_Paulo': 'BR',
};
export function guessCountry() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TZ[tz]) return TZ[tz];
    const m = (navigator.language || '').match(/-([A-Z]{2})$/);
    if (m && CODES.includes(m[1])) return m[1];
  } catch {}
  return '';
}

export function cleanSignup(s = {}) {
  const src = SOURCES.some(([k]) => k === s.source) ? s.source : 'other';
  return {
    source: src,
    sourceOther: src === 'other' ? String(s.sourceOther || '').replace(/\s+/g, ' ').trim().slice(0, 60) : '',
    country: CODES.includes(s.country) ? s.country : '',
    uses: (Array.isArray(s.uses) ? s.uses : []).filter((u) => USES.some(([k]) => k === u)).slice(0, USES.length),
  };
}
