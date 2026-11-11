// Nibble as a static SVG (same shapes as draw.js) – used for the favicon and the Windows .ico.
export function nibbleSvg(s = {}, size = 256) {
  const c = { body: '#7ee8c6', belly: '#e3fff5', ear: '#ff9fb8', line: '#23343c', eye: '#1b2429', glow: '#ffd166', cheek: '#ff8fab', foot: '#74d5b6', ...s };
  const ear = (x, deg) => `<g transform="translate(${x} -33) rotate(${deg})"><path d="M-6.5 0Q-3.64-13.1 0-14.56Q3.64-13.1 6.5 0Z" fill="${c.body}"/><path d="M-3.12-1.75Q-1.56-9.9 0-10.77Q1.56-9.9 3.12-1.75Z" fill="${c.ear}" stroke="none"/></g>`;
  const eye = (x) => `<ellipse cx="${x}" cy="-23" rx="3.5" ry="4.6" fill="${c.eye}" stroke="none"/><ellipse cx="${x + 1.2}" cy="-24.6" rx="1.3" ry="1.5" fill="#fff" stroke="none"/><circle cx="${x - 1.2}" cy="-21.2" r=".6" fill="#fff" stroke="none"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 120 120"><g transform="translate(62 110) scale(1.78)" stroke="${c.line}" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round">
<g transform="translate(-19 -9) rotate(-23)"><path d="M0 0C-8-2-12-10-9-17" fill="none" stroke-width="6.5"/><path d="M0 0C-8-2-12-10-9-17" fill="none" stroke="${c.body}" stroke-width="3.6"/></g>
<ellipse cx="-8" cy="-2.6" rx="5" ry="3" fill="${c.foot}"/>
${ear(-11, -14)}${ear(13, 12.6)}
<path d="M1-38Q1-46 4-51" fill="none" stroke-width="1.8"/><circle cx="4" cy="-52.5" r="3.1" fill="${c.glow}" stroke-width="1.5"/>
<path d="M-21.5-19.5C-21.5-30.81-11.2-39 1.5-39C14.2-39 24.5-30.81 24.5-19.5C24.5-4.88 15.76-.39 1.5-.39C-12.76-.39-21.5-4.88-21.5-19.5Z" fill="${c.body}"/>
<path d="M-9.5-12C-9.5-17.22-3.68-21 3.5-21C10.68-21 16.5-17.22 16.5-12C16.5-5.25 11.56-3.18 3.5-3.18C-4.56-3.18-9.5-5.25-9.5-12Z" fill="${c.belly}" opacity=".85" stroke="none"/>
<ellipse cx="-9" cy="-31" rx="4.5" ry="2.2" transform="rotate(-28.6 -9 -31)" fill="#fff" opacity=".35" stroke="none"/>
${eye(-6.5)}${eye(9.5)}
<ellipse cx="-12" cy="-16.5" rx="3.3" ry="2" fill="${c.cheek}" opacity=".55" stroke="none"/><ellipse cx="15.5" cy="-16.5" rx="3.3" ry="2" fill="${c.cheek}" opacity=".55" stroke="none"/>
<path d="M-1.5-16.4Q0-14.4 1.6-16.4Q3.2-14.4 4.7-16.4" fill="none" stroke="${c.eye}" stroke-width="1.5"/>
<g transform="translate(-17 -14) rotate(17)"><ellipse cx="0" cy="3.5" rx="3.2" ry="4.3" fill="${c.body}" stroke-width="2"/></g>
<g transform="translate(19 -14) rotate(-17)"><ellipse cx="0" cy="3.5" rx="3.2" ry="4.3" fill="${c.body}" stroke-width="2"/></g>
<ellipse cx="9" cy="-2.6" rx="5" ry="3" fill="${c.body}"/>
</g></svg>`;
}
