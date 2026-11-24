import { MS_STORE } from '../../lib/facts';

// Download badges: the official Microsoft Store badge (Microsoft's own artwork, from get.microsoft.com),
// a Mac badge in the same shape (Nibble isn't on the Mac App Store yet, so no Apple badge/logo), and
// plain direct-download links underneath.
export default function StoreBadges({ center, direct = true }) {
  return (
    <div className={'lp-badges' + (center ? ' center' : '')}>
      <div className="lp-badge-row">
        <a className="lp-badge ms" href={MS_STORE} target="_blank" rel="noopener" aria-label="Get Nibble from the Microsoft Store">
          <img src="https://get.microsoft.com/images/en-us%20dark.svg" alt="Get it from Microsoft" width={176} height={52} />
        </a>
        <a className="lp-badge mac" href="/Nibble.dmg" aria-label="Download Nibble for Mac">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden><path fill="currentColor" d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5V15H4V5.5zM6 6v7h12V6H6zM2 16.5h20l-1.2 2.1a1.5 1.5 0 0 1-1.3.9h-15a1.5 1.5 0 0 1-1.3-.9L2 16.5z" /></svg>
          <span><small>Download for</small><b>macOS</b></span>
        </a>
      </div>
      {direct && (
        <p className="lp-badge-direct">
          Direct download: <a href="/Get-Nibble.exe" download="Get-Nibble.exe">Windows (.exe)</a> · <a href="/Nibble.dmg">Mac (.dmg)</a> · <a href="/app">Open in your browser</a>
        </p>
      )}
    </div>
  );
}
