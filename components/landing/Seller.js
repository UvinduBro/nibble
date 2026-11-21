import { SELLER } from '../../lib/facts';

// "Who you're buying from": shown on /pricing, /refunds and /terms (Stripe checks the site names the seller)
export default function Seller() {
  return (
    <div className="lp-seller">
      <p><b>Company details</b></p>
      <p>{SELLER.name}</p>
      <p>{SELLER.street}, {SELLER.city}, {SELLER.country}</p>
      <p>Email: <a href={'mailto:' + SELLER.email}>{SELLER.email}</a> · or use the <a href="/#contact">contact form</a></p>
      <p className="lp-fine">Nibble is made by Uvindu Rajapakshe and Wageesha Ruvangi in Colombo, Sri Lanka, and operated by {SELLER.name}.</p>
    </div>
  );
}
