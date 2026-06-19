// Builds JSON-LD structured data for the virtual-number landing pages.
// Returns an array of schema.org objects to drop into <script type="application/ld+json">.
// Prices are a STATIC range (brand copy), not live per-combination data.

const SITE = 'https://www.textlix.com';

export function landingJsonLd({ countryName, serviceName, canonical, faqs }) {
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${countryName} Virtual Number for ${serviceName}`,
    description: `A virtual ${countryName} phone number for ${serviceName} SMS verification. Codes delivered in real time, with an automatic refund if none arrives.`,
    brand: { '@type': 'Brand', name: 'textlix' },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'USD',
      lowPrice: '0.50',
      highPrice: '5.00',
      offerCount: '100',
      availability: 'https://schema.org/InStock',
      url: canonical,
    },
  };

  const faqPage = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Virtual Numbers', item: `${SITE}/virtual-numbers` },
      { '@type': 'ListItem', position: 3, name: `${countryName} · ${serviceName}`, item: canonical },
    ],
  };

  return [product, faqPage, breadcrumb];
}
