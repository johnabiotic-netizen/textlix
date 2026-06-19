// SSR entry used ONLY by the prerender generator (scripts/prerender-pseo.mjs).
// It renders the public marketing routes to static HTML at build time. It does
// NOT import App.jsx / main.jsx, so none of the app bootstrap (auth, SSO, the
// service worker, the TikTok pixel) runs here — the live SPA is untouched.
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import VirtualNumberLandingPage from '../pages/public/VirtualNumberLandingPage';
import VirtualNumbersIndexPage from '../pages/public/VirtualNumbersIndexPage';

// Render one URL to { body, head }:
//   body — static markup to drop into <div id="root">
//   head — the per-page <title>/<meta>/<link>/<script> collected from Helmet
export async function render(url) {
  const helmetContext = {};
  const body = renderToStaticMarkup(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={url}>
        <Routes>
          <Route path="/virtual-numbers" element={<VirtualNumbersIndexPage />} />
          <Route path="/virtual-numbers/:countryCode/:serviceSlug" element={<VirtualNumberLandingPage />} />
        </Routes>
      </StaticRouter>
    </HelmetProvider>
  );
  const { helmet } = helmetContext;
  const head = helmet
    ? [
        helmet.title.toString(),
        helmet.meta.toString(),
        helmet.link.toString(),
        helmet.script.toString(),
      ].join('')
    : '';
  return { body, head };
}
