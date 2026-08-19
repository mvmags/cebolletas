# How it’s built
Component	Implementation	Public route
Main site	Vanilla HTML/CSS/JavaScript, bilingual, hash-based navigation	cebolletas.mx
Copal microsite	Separate vanilla JS application with gallery and reservation flow	cebolletas.mx/copal/
Admin portal	Static frontend using Supabase Auth, database, RLS, and RPC functions	cebolletas.mx/copal/manage/
Visitor rules	Standalone bilingual page introduced in v10.2.0	cebolletas.mx/reglamento/
Hosting	GitHub Pages from main	—
DNS	GoDaddy nameservers; records target GitHub Pages	—
Backend	Supabase database, authentication, Edge Function, and Telegram notification trigger	—


GoDaddy is managing DNS, not serving the website:
- Apex domain resolves to GitHub Pages’ four 185.199.*.153 addresses.
- www.cebolletas.mx points to mvmags.github.io.
- Nameservers are ns21.domaincontrol.com and ns22.domaincontrol.com.
- The repository’s CNAME correctly contains cebolletas.mx.
  Live-site findings
  cebolletas.mx
  The main site is operational and structurally strong:
- Clear Spanish/English support.
- Proper page title, description, language attribute, heading hierarchy, labels, ARIA navigation, FAQ controls, and image alternatives.
- Strong content hierarchy covering hours, location, activities, guidelines, FAQs, social media, Copal, and contact.
- Email and WhatsApp contact actions are generated entirely in the browser.
- The layout uses an internally scrolling .content-region; the document itself remains fixed to the viewport.
  The experience is visually coherent, although the custom scrolling model adds complexity for keyboard navigation, browser find, accessibility tooling, and deep-link behavior.
  cebolletas.mx/copal
  The Copal microsite loads correctly and includes:
- Bilingual content.
- Six gallery categories.
- Reservation dates and guest counts.
- A dynamically loaded Supabase service catalog.
- Automatic or manual pricing logic.
- Validated persistence through a public, narrowly scoped Supabase RPC.
- WhatsApp and email handoff after saving the request.
  One visible data/configuration problem stands out: “Hospedaje en Cebolletas Copal + Camping” displays “Desde $0 / noche.” The frontend already supports “Precio a consultar,” but the current Supabase catalog appears to mark this service as automatically priced with a zero base price.
  Management route
  cebolletas.mx/manage returns GitHub Pages’ 404 page.
  The actual admin portal is:
  cebolletas.mx/copal/manage/
  It loads successfully with an email/password login and noindex, nofollow. I did not attempt to sign in.
  Before authentication, no management data is exposed. The repository shows:
- Supabase Auth for identity.
- admin_profiles for authorization and active-user checks.
- Row-level security on administrative tables.
- Admin-only read policies.
- SECURITY DEFINER functions with restricted execution grants.
- No service-role key in browser code.
- A public Supabase publishable key, which is expected and safe only because RLS/RPC authorization is enforced.
- Telegram secrets stored server-side in Supabase Vault.
  Latest tags
  The current main commit is also tagged v10.2.0.
- v10.2.0 — August 12, 2026: added the bilingual visitor-rules page.
- v10.0.1 — August 11: clarified estimated reservation pricing.
- v10.0.0 — August 4: redesigned the root website.
- v9.2.3 — August 3: updated reservation wording.
  There is no v10.1.0 tag even though the root HTML loads script.js?v=10.1.0.
  Highest-impact opportunities
1. Fix the management URL mismatch. Add a lightweight /manage/index.html redirect to /copal/manage/, or update every reference to use the canonical route.
2. Correct the $0 Copal + Camping price. Either provide the intended base price or enable price_on_request.
3. Optimize images aggressively. The current tree contains:
    - 166 files totaling approximately 180 MB.
    - 98 images totaling approximately 178 MB.
    - Individual gallery images as large as 5.7 MB.
    - Roughly 129 MB under copal/ alone.
      Copal immediately creates multiple gallery image elements without native lazy loading. Responsive WebP/AVIF variants, thumbnails, srcset, and loading="lazy" would materially improve mobile performance.
4. Link the new Reglamento page. Version 10.2.0 added it, but the main site does not currently link to /reglamento/; visitors only see the shorter inline guidelines.
5. Improve SEO and sharing metadata. The public pages have basic title/description metadata but no canonical URL, Open Graph/Twitter metadata, structured data, sitemap, or robots.txt. Most primary content is also injected by JavaScript rather than present in the initial HTML.
6. Add a privacy notice. Both public sites collect or prepare names, email addresses, phone numbers, dates, and messages. Copal persists this data in Supabase, so a clear privacy notice and form acknowledgement would be appropriate.
7. Strengthen browser security. GitHub Pages responses do not include a content security policy or other customizable security headers. The admin app also imports Supabase JS from jsDelivr at runtime. Bundling or pinning that dependency more defensibly—and introducing a proxy/CDN capable of security headers—would reduce supply-chain exposure.
8. Clean repository weight. Original HEIC/JPEG files, duplicate logo files, and .idea project metadata are present on the deployed branch. Moving source originals outside the Pages branch would reduce repository and deployment weight.