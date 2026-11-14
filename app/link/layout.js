// the desktop app's sign-in bridge: not a page for search engines
export const metadata = { title: 'Sign in to Nibble', robots: { index: false, follow: false } };

export default function LinkLayout({ children }) { return children; }
