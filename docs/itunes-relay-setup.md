# Your own iTunes relay (Cloudflare Worker) — ~10 minutes, free

This gives the Jazz Constellation a private, reliable relay for Apple/iTunes lookups, so music previews and Apple Music links work consistently on your iPhone (and your friends' phones) instead of relying on flaky shared public relays.

## Steps

1. Go to **https://dash.cloudflare.com/sign-up** and create a free account (email + password). No credit card needed.

2. Once signed in, in the left sidebar click **Workers & Pages**.

3. Click **Create application** → **Create Worker**.

4. Give it a name like **jazz-itunes** (this becomes part of its web address). Click **Deploy** (it deploys a default "Hello World" first — that's fine).

5. Click **Edit code** (top right). Delete everything in the editor and paste in the code below (from `worker.js`). Then click **Deploy** (top right).

6. At the top of the page you'll see your Worker's address, something like:
   **`https://jazz-itunes.YOUR-NAME.workers.dev`**
   Copy that whole address.

7. **Send me that address.** I'll wire it into the site as the primary relay, and previews + Apple links will go through your private, reliable relay first.

## The Worker code

See the file `itunes-relay-worker.js` in this same folder — copy its entire contents into the Cloudflare editor in step 5.

## What it does

- Takes a request like `…workers.dev/?url=<an itunes.apple.com search URL>`
- Fetches that from Apple on the server side (no browser cross-origin block)
- Returns the result with the headers your browser needs, and caches it for a day

That's the whole thing. Nothing to maintain.
