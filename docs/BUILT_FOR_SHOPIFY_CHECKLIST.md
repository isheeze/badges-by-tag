# Built for Shopify Readiness Checklist

Built for Shopify is evaluated after the public app is live and has merchant activity. This app is prepared for the code-level criteria, but the final badge depends on Shopify's automatic metrics and manual review.

## Code-level readiness

- Embedded app uses the official Shopify React Router template and App Bridge provider.
- Primary workflows are inside Shopify admin: onboarding, badge management, pricing, and support.
- No manual shop-domain entry is shown in the app UI.
- App uses GraphQL Admin API requests for Shopify data.
- App requests only the `read_themes` access scope.
- Mandatory privacy webhooks are implemented and configured.
- Billing uses Shopify Billing API when `BILLING_ENABLED=1`.
- Merchants can upgrade to Pro and downgrade to Free from the app.
- App pages use responsive layouts that avoid horizontal page scrolling on mobile.
- Theme app extension is lightweight: one small deferred script and CSS, no remote storefront assets.

## Metrics Shopify must observe

- At least 50 net installs from active shops on paid Shopify plans.
- At least 5 app reviews.
- Recent app rating above Shopify's current minimum threshold.
- Admin Web Vitals at the 75th percentile:
  - LCP at or below 2.5 seconds.
  - CLS at or below 0.1.
  - INP at or below 200 milliseconds.
- Storefront Lighthouse performance score drop is no more than 10 points.

## Production checks

- Deploy to a fast HTTPS host close to merchant traffic.
- Use a managed production database for Prisma session storage.
- Replace all placeholder URLs in `shopify.app.toml`.
- Configure valid privacy policy, terms, support email, and listing URLs.
- Add high-quality listing screenshots for Home, Badges, Pricing, Support, and the theme app block.
- Test embedded app pages in desktop and mobile Shopify admin.
- Test storefront badge rendering on desktop and mobile.
