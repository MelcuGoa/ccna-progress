# Summer of CCNA 2026 Progress Tracker

A tiny self-hosted web app for tracking the checklist from `Summer of CCNA Study Plan.pdf`.

The app is intentionally simple:

- `server.js` is a dependency-free Node.js HTTP server.
- `public/` contains the PWA user interface, manifest, service worker, and icons.
- `data/checklist.json` contains the default checklist data.
- `deploy/` contains example Ubuntu `systemd` and nginx configuration.

Progress is saved by writing JSON to disk. On a server, keep that writable data file outside the application folder so app updates do not overwrite it.

![CCNA Progress Tracker screenshot](images/ss1.png)

## Requirements

- Node.js 20 or newer
- Ubuntu server with `systemd` and nginx for the deployment flow below
- A domain name pointed at your server if you want HTTPS

No `npm install` step is needed because the app has no runtime dependencies.

## Run Locally

From the project folder:

```bash
npm start
```

Then open:

```text
http://127.0.0.1:8088
```

Useful environment variables:

```bash
HOST=127.0.0.1 PORT=8088 CCNA_DATA_FILE=/path/to/checklist.json npm start
```

- `HOST` defaults to `127.0.0.1`.
- `PORT` defaults to `8088`.
- `CCNA_DATA_FILE` defaults to `data/checklist.json` in this repo.

## Deploy On Your Own Ubuntu Server

These commands install the app at `/opt/ccna-progress`, run it as a locked-down system user, store progress at `/var/lib/ccna-progress/checklist.json`, and expose it through nginx.

Replace `ccna.example.com` with your own domain.

### 1. Install Node.js And Nginx

Install Node.js 20, npm, and nginx:

```bash
sudo apt update
sudo apt install -y curl ca-certificates
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx
node --version
npm --version
```

The included service file uses `/usr/bin/node`. Confirm that path exists:

```bash
which node
```

If your Node binary is somewhere else, edit `deploy/ccna-progress.service` before copying it to `/etc/systemd/system/`.

### 2. Copy The App

From your workstation, copy the repo to the server:

```bash
rsync -av --delete ./ user@your-server:/tmp/ccna-progress/
```

Then on the server:

```bash
sudo mkdir -p /opt/ccna-progress
sudo rsync -av --delete /tmp/ccna-progress/ /opt/ccna-progress/
```

You can also use `git clone` directly on the server if the repository is available there.

### 3. Create The App User And Data File

```bash
sudo useradd --system --home /opt/ccna-progress --shell /usr/sbin/nologin ccna-progress
sudo mkdir -p /var/lib/ccna-progress
sudo cp /opt/ccna-progress/data/checklist.json /var/lib/ccna-progress/checklist.json
sudo chown -R ccna-progress:ccna-progress /opt/ccna-progress /var/lib/ccna-progress
```

If you are redeploying an existing install, do not overwrite `/var/lib/ccna-progress/checklist.json` unless you intentionally want to reset progress.

### 4. Install And Start The Systemd Service

```bash
sudo cp /opt/ccna-progress/deploy/ccna-progress.service /etc/systemd/system/ccna-progress.service
sudo systemctl daemon-reload
sudo systemctl enable --now ccna-progress
sudo systemctl status ccna-progress
```

Check the local health endpoint:

```bash
curl http://127.0.0.1:8088/health
```

Expected response:

```json
{"ok":true}
```

### 5. Configure Nginx

Edit the server name in the example config:

```bash
sudo nano /opt/ccna-progress/deploy/nginx.conf
```

Change this line:

```nginx
server_name ccna.example.com;
```

Then enable the site:

```bash
sudo cp /opt/ccna-progress/deploy/nginx.conf /etc/nginx/sites-available/ccna-progress
sudo ln -s /etc/nginx/sites-available/ccna-progress /etc/nginx/sites-enabled/ccna-progress
sudo nginx -t
sudo systemctl reload nginx
```

Open your domain in a browser. You should see the tracker UI.

### 6. Enable HTTPS

After DNS points to your server, install Certbot and request a certificate:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d ccna.example.com
```

Certbot will update nginx and set up certificate renewal.

## Updating The App

Production progress should remain in `/var/lib/ccna-progress/checklist.json`. Do not replace that file during app updates unless you intentionally want to reset the checklist.

Before updating, make a timestamped backup:

```bash
sudo mkdir -p /var/lib/ccna-progress/backups
sudo cp /var/lib/ccna-progress/checklist.json "/var/lib/ccna-progress/backups/checklist.$(date +%Y%m%d-%H%M%S).json"
```

If you deploy by copying files from your workstation, copy the app to a temporary folder first:

```bash
rsync -av --delete ./ user@your-server:/tmp/ccna-progress/
```

Then, on the server, sync the app folder without touching the production data file:

```bash
sudo rsync -av --delete /tmp/ccna-progress/ /opt/ccna-progress/
sudo chown -R ccna-progress:ccna-progress /opt/ccna-progress
sudo chown ccna-progress:ccna-progress /var/lib/ccna-progress/checklist.json
```

If the repository is cloned directly on the server, update it from `/opt/ccna-progress`:

```bash
cd /opt/ccna-progress
sudo git pull
sudo chown -R ccna-progress:ccna-progress /opt/ccna-progress
sudo chown ccna-progress:ccna-progress /var/lib/ccna-progress/checklist.json
```

Restart the service and verify health:

```bash
sudo systemctl restart ccna-progress
curl http://127.0.0.1:8088/health
```

Expected response:

```json
{"ok":true}
```

If `deploy/ccna-progress.service` changed, copy it again and reload systemd:

```bash
sudo cp /opt/ccna-progress/deploy/ccna-progress.service /etc/systemd/system/ccna-progress.service
sudo systemctl daemon-reload
sudo systemctl restart ccna-progress
```

If `deploy/nginx.conf` changed, copy it again, test nginx, and reload:

```bash
sudo cp /opt/ccna-progress/deploy/nginx.conf /etc/nginx/sites-available/ccna-progress
sudo nginx -t
sudo systemctl reload nginx
```

After frontend changes, refresh the browser. If the UI still looks old, unregister the old service worker or clear the site data in the browser; the app also bumps `public/sw.js` cache names when app shell assets need a clean refresh.

## Backups

The progress you care about lives here:

```text
/var/lib/ccna-progress/checklist.json
```

Back it up before server maintenance or app updates:

```bash
sudo cp /var/lib/ccna-progress/checklist.json /var/lib/ccna-progress/checklist.backup.json
```

## Troubleshooting

View service logs:

```bash
sudo journalctl -u ccna-progress -f
```

Restart the app:

```bash
sudo systemctl restart ccna-progress
```

Verify nginx can reach the Node service:

```bash
curl http://127.0.0.1:8088/health
```

Common things to check:

- The `ccna-progress` service is running.
- Port `8088` is not already used by another local service.
- `/var/lib/ccna-progress/checklist.json` exists and is owned by `ccna-progress`.
- nginx `server_name` matches your domain.
- DNS points to your server before running Certbot.
