// Product Hunt "Featured" badge (Product Hunt's own embed, as they gave it).
export default function ProductHuntBadge({ className = '', width = 250 }) {
  return (
    <a className={'lp-ph ' + className} href="https://www.producthunt.com/products/nibble-4?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-nibble-6" target="_blank" rel="noopener noreferrer">
      <img alt="Nibble - A cute desktop pet that hangs out with your friends’ pets | Product Hunt" width={width} height={Math.round(width * 54 / 250)} src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1330108&theme=light&t=1795592630147" />
    </a>
  );
}
