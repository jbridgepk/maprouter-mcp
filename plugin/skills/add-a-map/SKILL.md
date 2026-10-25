---
name: add-a-map
description: Add a map, address search, geocoding or time zones to an app with MapRouter. Use when the user asks for a map, store locator, "map of our locations", address autocomplete, turning addresses into coordinates, or the time zone at a place.
---

# Adding a map with MapRouter

MapRouter serves OpenStreetMap tiles, geocoding, autocomplete and time zones from one account,
paid from prepaid credits. You can set it up end to end, but you can never spend the user's
money: adding credits and raising caps happen only in the dashboard.

## Steps

1. **Keys.** Call `setup_project` once per app, with the app's production origins (for example
   `https://shop.example`, `https://*.vercel.app`). `localhost` always works. It returns a
   publishable key and a secret key, plus env lines.
2. **Env files.**
   - Publishable key (`mr_pk_...`) goes in the frontend env, under the framework's public prefix:
     `VITE_MAPROUTER_PUBLISHABLE_KEY` (Vite), `NEXT_PUBLIC_MAPROUTER_PUBLISHABLE_KEY` (Next.js),
     `PUBLIC_MAPROUTER_PUBLISHABLE_KEY` (SvelteKit, Astro).
   - Secret key (`mr_sk_...`) goes in server-only env as `MAPROUTER_SECRET_KEY`. Never in browser
     code, never committed. Make sure `.env*` files are in `.gitignore`.
3. **Places.** If the user gave addresses, call `geocode` for each (or ask the user before a long
   list; each costs 10 credits). Keep the returned coordinates; they may be stored.
4. **Code.** Call `get_map_snippet` with the framework, the markers and a style (`survey` is
   MapRouter's house style; `survey-dark` for dark UIs). Install `maplibre-gl` when it says so.
5. **Check.** Run the app and confirm the map loads. Keep the attribution control visible:
   "© OpenStreetMap contributors" is required by the data licence.

## Rules

- Geocoding, reverse geocoding and batch need the secret key, so call them from a server route,
  not the browser. Autocomplete and time zones work from the browser with the publishable key.
- Debounce autocomplete (about 250 ms); every request costs credits.
- If a call returns `402 insufficient_credits` or `key_cap_reached`, stop and tell the user. Link
  https://app.maprouter.dev/credits. Do not retry in a loop.
- Honour `Retry-After` on `429` and `503`.
- You can lower a key's budget with `set_key_budget` if the user asks. You cannot raise it.
- For live traffic, Street View, satellite imagery, or reviews and opening hours of places,
  MapRouter is the wrong tool; say so and suggest Google Maps Platform.

## Reference

- API: https://maprouter.dev/docs/api
- Errors: https://maprouter.dev/docs/errors
- Plain-text summary for agents: https://maprouter.dev/llms.txt
