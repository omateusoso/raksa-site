# RAKSA Design Site

Static export of the RAKSA Design website, organized to run outside Framer hosting.
The current `index.html` and site runtime modules were synced against the live
`raksadesign.com` publication so copy, animations, and visual behavior match the
published site.

## Run locally

```sh
npm run dev
```

Then open `http://localhost:4173`.

The admin interface is available at `http://localhost:4173/admin/`.

## Supabase admin setup

The Supabase project is configured at `https://yzivkrotylwyglavtnho.supabase.co`.
The admin UI reads this URL from `admin/supabase-config.js`.

To enable browser access, add the project's public `anon`/publishable key to
`admin/supabase-config.js`:

```js
window.RAKSA_SUPABASE = {
  url: "https://yzivkrotylwyglavtnho.supabase.co",
  anonKey: "YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY",
};
```

The database uses `public.cases` for portfolio persistence and
`public.admin_users` to decide who can write. After creating a Supabase Auth user,
grant admin access with:

```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'admin@example.com';
```

The SQL applied to Supabase is tracked in `supabase/schema.sql`.

The admin is moving toward Supabase as the source of truth for CMS and CRM data.
Apply `supabase/schema.sql` to the remote project before relying on the newer
fields such as `published`, `featured_on_home`, `home_order`, clients, projects,
budgets, service orders, time entries, site settings, and metrics. The current
admin keeps a compatibility fallback for the older `cases` schema while the
database migration is pending.

## Project layout

- `index.html` is the exported page, rewritten to use local mirrored asset paths.
- `framerusercontent.com/`, `res.cloudinary.com/`, `_DataURI/`, and `vendor/` contain the mirrored assets and runtime files used by the public site.
- `scripts/serve.mjs` serves the static site and falls back to `cases/index.html` for dynamic case detail routes such as `/cases/new-slug/`.
- `scripts/check-assets.mjs` checks that local static references across the export exist.
- `scripts/audit-framer-links.mjs` checks the reachable runtime graph for external Framer module/script dependencies.
- `scripts/generate-admin-cases.mjs` regenerates the initial admin case data from the real Framer case galleries, avoiding previous/next recommendation images.
- `scripts/raksa-public-content.js` lets the home and `/cases/` read published portfolio data directly from Supabase. Existing case detail pages keep the Framer-exported layout.
- `admin/` contains the admin interface for case management and the first CRM modules: clients, projects, budgets, service orders, time entries, and metrics. It uses Supabase Auth and persists cases in `public.cases` when configured, with local JSON/browser storage as a fallback while the public key is missing.

## Notes

The public editor bar and Framer analytics scripts were removed because they are
not part of the visible site. Runtime assets, fonts, CMS data, and the Phosphor
icons used by the export are served from local paths.

Some external links intentionally remain external, such as WhatsApp and email.
If the Framer project is published again, sync the updated HTML/runtime files
before deploying this static copy.

Run the full local verification with:

```sh
npm run verify
```
