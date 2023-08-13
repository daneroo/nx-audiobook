# Plex setup for audiobooks

The main reason to use this was to get a server for BookCamp.

## TODO

- [ ] Make configuration repeatable (NixOS?)

## plex-audiobook VM on hilbert

- plex-audiobook.imetrical.com -> 192.168.2.112
- ubuntu 22.04 / 4 cores/8G/256G

Adjust Plex Setting: Network: Advanced: Custom server access URLs:
to `http://plex-audiobook.imetrical.com:32400/, http://192.168.2.112:32400/`.

Plex's main configutation is in:

- `/var/lib/plexmediaserver/Library/Application Support/Plex Media Server/Preferences.xml`

## Install plex in ubuntu

```bash
curl https://downloads.plex.tv/plex-keys/PlexSign.key | sudo apt-key add -
echo deb https://downloads.plex.tv/repo/deb public main | sudo tee /etc/apt/sources.list.d/plexmediaserver.list

sudo apt update
sudo apt install plexmediaserver

# check plex is running
sudo systemctl status plexmediaserver
```

### Remote (SMB) content

This is how we mount some content with CIFS/SMB from synology

```bash
sudo apt update
sudo apt install cifs-utils

# Add this user (plex-audiobook) to synology, with read-only access to Share(s)
sudo nano /etc/synology-cifs-credentials
# password: echo -n sekret|sha1sum
# username=plex-audiobook
# password=a1b9892611956aa13a5ab9ccf01f49662583f2d2
sudo chmod 400 /etc/synology-cifs-credentials

sudo mkdir -p /Volumes/Reading
#  to test
sudo mount -t cifs -o ro,vers=3.0,credentials=/etc/synology-cifs-credentials //syno.imetrical.com/Reading /Volumes/Reading
sudo umount /Volumes/Reading

# to make permanent and append:
sudo nano /etc/fstab
# //syno.imetrical.com/Reading /Volumes/Reading cifs ro,vers=3.0,credentials=/etc/synology-cifs-credentials
sudo mount -a

# Draw the rest of the Owl: set paths inside plex...
```

### Also mounting /Archive (temporarily)

```bash
mkdir -p /Volumes/Space/archive
# This will prompt for password
sudo mount -t cifs -o ro,vers=3.0,user=daniel //syno.imetrical.com/Archive /Volumes/Space/archive
```

## Install Audnexus

```bash
# ~plex == /var/lib/plexmediaserver
cd ~plex/Library/Application\ Support/Plex\ Media\ Server/Plug-ins
sudo git clone https://github.com/djdembeck/Audnexus.bundle.git
sudo chown -R plex: Audnexus.bundle

sudo systemctl restart plexmediaserver
```

## Create an audiobook library

- From within Plex Web, create a new library, with the MUSIC type, and name it **Audiobooks**.
- Add your folders.

In the ADVANCED tab:

- Scanner: `Plex Music Scanner`
- Agent: `Audnexus Agent`
- Toggle agent settings as you please.
- Uncheck all boxes except `Store track progress`
- Genres: `Embedded tags`
- Album Art: `Local Files Only`

Add the library and go do anything but read a physical book while the magic happens :)

## References

- [Guide](https://github.com/seanap/Plex-Audiobook-Guide?utm_source=pocket_mylist#players)
- [plex in docker](https://github.com/plexinc/pms-docker)
- [plex on ubuntu](https://linuxize.com/post/how-to-install-plex-media-server-on-ubuntu-20-04/)
- [SMB/CIFS on ubuntu](https://linuxhint.com/mount-smb-shares-on-ubuntu/)
- [Audnexus](https://github.com/djdembeck/Audnexus.bundle)
