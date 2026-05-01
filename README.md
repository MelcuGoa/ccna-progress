# CCNA Progress Tracker

A tiny self-hosted web app for tracking the checklist from `Summer of CCNA Study Plan.pdf`.

## Local Run

```bash
npm start
```

Then open `http://127.0.0.1:8088`.

## Ubuntu Service Deployment

Copy this folder to `/opt/ccna-progress`, then seed the writable data file:

```bash
sudo useradd --system --home /opt/ccna-progress --shell /usr/sbin/nologin ccna-progress
sudo mkdir -p /var/lib/ccna-progress
sudo cp /opt/ccna-progress/data/checklist.json /var/lib/ccna-progress/checklist.json
sudo chown -R ccna-progress:ccna-progress /opt/ccna-progress /var/lib/ccna-progress
sudo cp /opt/ccna-progress/deploy/ccna-progress.service /etc/systemd/system/ccna-progress.service
sudo systemctl daemon-reload
sudo systemctl enable --now ccna-progress
```

Install the nginx config as a separate site:

```bash
sudo cp /opt/ccna-progress/deploy/nginx.conf /etc/nginx/sites-available/ccna-progress
sudo ln -s /etc/nginx/sites-available/ccna-progress /etc/nginx/sites-enabled/ccna-progress
sudo nginx -t
sudo systemctl reload nginx
```

Change `server_name ccna.example.com;` in `deploy/nginx.conf` to the DNS name you want to use.

For HTTPS, after DNS points at the server:

```bash
sudo certbot --nginx -d ccna.example.com
```
