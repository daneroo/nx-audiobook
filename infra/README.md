# Infra for audiobooks

Moved from <https://github.com/daneroo/plex-audiobook>

_Note_: as of 2023-08-12 I reinstalled plexmediaserver on this host, by restoring to the 2023-07-16 snapshot.
_Note_: as of 2023-07-17 I uninstalled plexmediaserver on this host, and will rebuild audiobookshelf on a new server (NixOS)

- `plex-audiobook` VM on proxmox@hilbert: is running both these services

  - This VM has daily snapshots on proxmox@hilbert
  - This VM mounts remote SMB: `//syno.imetrical.com/Reading to/Volumes/Space/Reading`
  - plex-audiobook.imetrical.com -> 192.168.2.112
    - link/ether 82:a1:71:54:20:4c brd ff:ff:ff:ff:ff:ff
    - ubuntu 22.04 / 4 cores/8G/256G

- Audiobookshelf

  - Local: <http://plex-audiobook.imetrical.com:13378/>
  - Local: <http://192.168.2.112:13378/>

- Plex server: Running as a service on this VM
  - [ ] REMOVE: Remote: <https://audiobook.dl.imetrical.com:443/web>
  - Local: <http://plex-audiobook.imetrical.com:32400/web>
  - Local: <http://192.168.2.112:32400/web>

## TODO

- [ ] Rename the canonical service names? Include Tailscale?
  - [ ] Remove remote (non-tailscale) <https://audiobook.dl.imetrical.com:443/web>
  - shelf.audiobook[.ts].imetrical.com
  - plex.audiobook[.ts].imetrical.com: DO Not expose
- [ ] Move audiobookshelf permanent to new/independent [NixOS] server

### Remote (SMB) content

This is how we mount some content with CIFS/SMB from synology.

- credentials in `/etc/synology-cifs-credentials`

```bash
sudo apt update
sudo apt install cifs-utils

# Add this user (plex-audiobook) to synology, with read-only access to Share(s)
sudo nano /etc/synology-cifs-credentials
# password: echo -n sekret|sha1sum
# username=plex-audiobook
# password=a1b9892611956aa13a5ab9ccf01f49662583f2d2
sudo chmod 400 /etc/synology-cifs-credentials

sudo mkdir -p /Volumes/Space/Reading
#  to test
sudo mount -t cifs -o ro,vers=3.0,credentials=/etc/synology-cifs-credentials //syno.imetrical.com/Reading /Volumes/Space/Reading
sudo umount /Volumes/Space/Reading

# to make permanent and append:
sudo nano /etc/fstab
## Keep the same structure /Volumes/Space/Reading
//syno.imetrical.com/Reading /Volumes/Space/Reading cifs ro,vers=3.0,credentials=/etc/synology-cifs-credentials

sudo mount -a

# Draw the rest of the Owl: set paths inside plex, and audiobookshelf
```

### Also mounting /Archive (temporarily)

```bash
mkdir -p /Volumes/Space/archive
# This will prompt for password
sudo mount -t cifs -o ro,vers=3.0,user=daniel //syno.imetrical.com/Archive /Volumes/Space/archive
```
