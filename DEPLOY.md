# Deploying

The app keeps its event log in SQLite on disk, so it needs a host with a
**persistent volume**. Anywhere the filesystem is ephemeral — Vercel and most
serverless platforms — the facts would still render but nothing a reviewer did
would survive, which is the opposite of the point.

Node's built-in `node:sqlite` is only available without a flag from Node 23.4 and
stable in 24, so the `Dockerfile` pins **Node 24** rather than letting a builder
guess. `railway.json` tells Railway to use that Dockerfile.

Verified locally before deploying: the image builds, serves 18 checks and 108
findings, writes an event, and the event survives the container being destroyed
and recreated against the same volume.

## Live

<https://miraflores-workpaper-production-756f.up.railway.app> — Railway, Dockerfile
build, volume mounted at `/data`.

Verified on the deployed service, not just locally: all endpoints answer, the app
reports its own 18 checks and 108 findings, an event written through the API
survived a redeploy onto a new container, and both of Letter 566's examined items
carry a high-severity finding.

One thing to know if you redeploy from a fresh clone: **Railway rejects a
Dockerfile `VOLUME` instruction** outright — "not supported, use Railway Volumes"
— and the build fails before anything runs. The mount is declared on the service
instead.

## Railway, from scratch

1. **New Project → Deploy from GitHub repo**, pick `jfu06/miraflores-workpaper`.
   Railway reads `railway.json` and builds the Dockerfile; no settings needed.
2. **Add a volume**: service → *Variables / Settings* → **+ Volume**, mount path
   exactly `/data`.
3. **Set one variable**: `EVENTS_DB_PATH=/data/events.db`.
   (The Dockerfile already defaults to this; set it explicitly so it is visible
   next to the volume rather than buried in an image layer.)
4. **Generate a domain**: Settings → Networking → *Generate Domain*.

Railway sets `PORT` itself and the server reads it.

### Checking it came up

```bash
curl -s https://<your-domain>/api/checks | head -c 120
```

Should report 18 checks. Then open the domain, go to **Open items**, and record
anything — a note on a line will do. Redeploy and look again: it is still there.

## Seeding a demonstration state

```bash
npm run seed                                     # against localhost:3000
npm run seed -- --url https://<your-domain>      # against a deployed instance
npm run seed -- --no-file                        # stop before filing
```

`scripts/seed.mjs` is a scripted session, not a fixture: it drives the app's own
HTTP API as Priya, Daniel and Helen in turn, so it meets the same rules a
reviewer does — independence, the 1,000 partner threshold, the filing freeze. If
one of those rules changes the seed fails loudly rather than writing a state the
app would never produce. It did exactly that on its first run, which is how three
missing tax-effect categories were found.

Use `--no-file` when recording a walkthrough, so the freeze can happen on camera.

### Starting over

The event log is append-only, so there is no reset — you start a new book.
Point `EVENTS_DB_PATH` at a different file:

```bash
railway variables --set "EVENTS_DB_PATH=/data/demo-2.db"
```

Locally, delete `data/events.db*` **and restart the dev server** — the open
handle survives the file.

## Anywhere else

Any host that runs a container with a disk works the same way. The only two
requirements are Node 24 and a writable path, and both are stated in the
`Dockerfile`.

To point the app at a different packet, set `PACKET_PATH`. Nothing else is
environment-specific.
