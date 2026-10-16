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

## Railway

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

## Anywhere else

Any host that runs a container with a disk works the same way. The only two
requirements are Node 24 and a writable path, and both are stated in the
`Dockerfile`.

To point the app at a different packet, set `PACKET_PATH`. Nothing else is
environment-specific.
