import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { COUNTRIES, SERVICES, STATS } from '../../data/pseoContent';

// Hub page at /virtual-numbers — the crawl entry point that links to every
// country × service landing page so none of them are orphans.
export default function VirtualNumbersIndexPage() {
  const canonical = 'https://www.textlix.com/virtual-numbers';
  const serviceSlugs = Object.keys(SERVICES);
  const countryCodes = Object.keys(COUNTRIES);

  return (
    <>
      <Helmet>
        <title>Virtual Phone Numbers for SMS Verification — textlix</title>
        <meta name="description" content={`Browse virtual phone numbers across ${STATS.countries} countries for ${STATS.services} services. Receive SMS verification codes in real time, with a full refund if no code arrives.`} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content="Virtual Phone Numbers for SMS Verification — textlix" />
        <meta property="og:description" content="Get a virtual number in any country for WhatsApp, Telegram, Google and 100+ more services. SMS codes delivered live." />
        <meta property="og:url" content={canonical} />
      </Helmet>

      <div className="min-h-screen bg-white dark:bg-gray-900 font-body">
        {/* Navbar */}
        <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl text-gray-900 dark:text-white">
              <span>✓</span> textlix
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/pricing" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Pricing</Link>
              <Link to="/faq" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">FAQ</Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">Sign in</Link>
              <Link to="/register" className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">Get Started</Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="bg-gradient-to-br from-[#0A1831] to-brand-600 text-white py-16 px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="font-display font-extrabold text-3xl md:text-5xl mb-4">Virtual Phone Numbers for SMS Verification</h1>
            <p className="text-lg text-brand-100">
              Pick a country and a service to get a virtual number and receive your code live in {STATS.delivery}. Across {STATS.countries} countries and {STATS.services} services.
            </p>
          </div>
        </section>

        {/* Directory: each service with its country links */}
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto space-y-12">
            {serviceSlugs.map((slug) => (
              <div key={slug}>
                <h2 className="font-display font-bold text-xl text-gray-900 dark:text-white mb-4">
                  {SERVICES[slug].emoji} {SERVICES[slug].name} numbers
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {countryCodes.map((code) => (
                    <Link
                      key={code}
                      to={`/virtual-numbers/${code}/${slug}`}
                      className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                    >
                      <span>{COUNTRIES[code].flag}</span>
                      <span className="truncate">{COUNTRIES[code].name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 bg-gradient-to-br from-[#0A1831] to-brand-600 text-white text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="font-display font-extrabold text-2xl md:text-3xl mb-4">Ready to get started?</h2>
            <p className="text-brand-100 mb-8">Create a free account, top up from $2, and get your first number in under a minute.</p>
            <Link to="/register" className="bg-white text-brand-600 font-semibold text-lg px-8 py-4 rounded-xl hover:bg-brand-50 transition-colors shadow-lg inline-block">
              Create Free Account
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-200 dark:border-gray-800 py-10 px-4 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl text-gray-900 dark:text-white">
              <span>✓</span> textlix
            </Link>
            <div className="flex gap-6 text-sm text-gray-500 dark:text-gray-400">
              <Link to="/pricing" className="hover:text-gray-700 dark:hover:text-gray-200">Pricing</Link>
              <Link to="/faq" className="hover:text-gray-700 dark:hover:text-gray-200">FAQ</Link>
              <Link to="/support" className="hover:text-gray-700 dark:hover:text-gray-200">Support</Link>
              <Link to="/terms" className="hover:text-gray-700 dark:hover:text-gray-200">Terms</Link>
              <Link to="/privacy" className="hover:text-gray-700 dark:hover:text-gray-200">Privacy</Link>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500">© 2026 textlix</p>
          </div>
        </footer>
      </div>
    </>
  );
}
