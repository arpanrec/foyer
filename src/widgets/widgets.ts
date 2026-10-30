import type { WidgetDefinition } from "@/types/widget-definition";
import adguard from "@/widgets/adguard/widget";
import apcups from "@/widgets/apcups/widget";
import arcane from "@/widgets/arcane/widget";
import argocd from "@/widgets/argocd/widget";
import atsumeru from "@/widgets/atsumeru/widget";
import audiobookshelf from "@/widgets/audiobookshelf/widget";
import authentik from "@/widgets/authentik/widget";
import autobrr from "@/widgets/autobrr/widget";
import azuredevops from "@/widgets/azuredevops/widget";
import backrest from "@/widgets/backrest/widget";
import bazarr from "@/widgets/bazarr/widget";
import beszel from "@/widgets/beszel/widget";
import booklore from "@/widgets/booklore/widget";
import bookorbit from "@/widgets/bookorbit/widget";
import caddy from "@/widgets/caddy/widget";
import calendar from "@/widgets/calendar/widget";
import calibreweb from "@/widgets/calibreweb/widget";
import changedetectionio from "@/widgets/changedetectionio/widget";
import channelsdvrserver from "@/widgets/channelsdvrserver/widget";
import checkmk from "@/widgets/checkmk/widget";
import cloudflared from "@/widgets/cloudflared/widget";
import coinmarketcap from "@/widgets/coinmarketcap/widget";
import crowdsec from "@/widgets/crowdsec/widget";
import customapi from "@/widgets/customapi/widget";
import deluge from "@/widgets/deluge/widget";
import develancacheui from "@/widgets/develancacheui/widget";
import diskstation from "@/widgets/diskstation/widget";
import dispatcharr from "@/widgets/dispatcharr/widget";
import dockhand from "@/widgets/dockhand/widget";
import downloadstation from "@/widgets/downloadstation/widget";
import duplicati from "@/widgets/duplicati/widget";
import emby from "@/widgets/emby/widget";
import esphome from "@/widgets/esphome/widget";
import evcc from "@/widgets/evcc/widget";
import feed from "@/widgets/feed/widget";
import filebrowser from "@/widgets/filebrowser/widget";
import fileflows from "@/widgets/fileflows/widget";
import firefly from "@/widgets/firefly/widget";
import flood from "@/widgets/flood/widget";
import freshrss from "@/widgets/freshrss/widget";
import frigate from "@/widgets/frigate/widget";
import fritzbox from "@/widgets/fritzbox/widget";
import gamedig from "@/widgets/gamedig/widget";
import gatus from "@/widgets/gatus/widget";
import ghostfolio from "@/widgets/ghostfolio/widget";
import gitea from "@/widgets/gitea/widget";
import gitlab from "@/widgets/gitlab/widget";
import glances from "@/widgets/glances/widget";
import gluetun from "@/widgets/gluetun/widget";
import gotify from "@/widgets/gotify/widget";
import grafana from "@/widgets/grafana/widget";
import hdhomerun from "@/widgets/hdhomerun/widget";
import headscale from "@/widgets/headscale/widget";
import healthchecks from "@/widgets/healthchecks/widget";
import homeassistant from "@/widgets/homeassistant/widget";
import homebox from "@/widgets/homebox/widget";
import homebridge from "@/widgets/homebridge/widget";
import immich from "@/widgets/immich/widget";
import jackett from "@/widgets/jackett/widget";
import jdownloader from "@/widgets/jdownloader/widget";
import jellyfin from "@/widgets/jellyfin/widget";
import jellystat from "@/widgets/jellystat/widget";
import karakeep from "@/widgets/karakeep/widget";
import kavita from "@/widgets/kavita/widget";
import komga from "@/widgets/komga/widget";
import komodo from "@/widgets/komodo/widget";
import kopia from "@/widgets/kopia/widget";
import lidarr from "@/widgets/lidarr/widget";
import linkwarden from "@/widgets/linkwarden/widget";
import livestreamer from "@/widgets/livestreamer/widget";
import lubelogger from "@/widgets/lubelogger/widget";
import mailcow from "@/widgets/mailcow/widget";
import maintainerr from "@/widgets/maintainerr/widget";
import mastodon from "@/widgets/mastodon/widget";
import mealie from "@/widgets/mealie/widget";
import medusa from "@/widgets/medusa/widget";
import mikrotik from "@/widgets/mikrotik/widget";
import minecraft from "@/widgets/minecraft/widget";
import miniflux from "@/widgets/miniflux/widget";
import mjpeg from "@/widgets/mjpeg/widget";
import moonraker from "@/widgets/moonraker/widget";
import mylar from "@/widgets/mylar/widget";
import myspeed from "@/widgets/myspeed/widget";
import navidrome from "@/widgets/navidrome/widget";
import netalertx from "@/widgets/netalertx/widget";
import netbird from "@/widgets/netbird/widget";
import netdata from "@/widgets/netdata/widget";
import nextcloud from "@/widgets/nextcloud/widget";
import nextdns from "@/widgets/nextdns/widget";
import npm from "@/widgets/npm/widget";
import ntfy from "@/widgets/ntfy/widget";
import nzbget from "@/widgets/nzbget/widget";
import octoprint from "@/widgets/octoprint/widget";
import omada from "@/widgets/omada/widget";
import ombi from "@/widgets/ombi/widget";
import opendtu from "@/widgets/opendtu/widget";
import openmediavault from "@/widgets/openmediavault/widget";
import openwrt from "@/widgets/openwrt/widget";
import opnsense from "@/widgets/opnsense/widget";
import pangolin from "@/widgets/pangolin/widget";
import paperlessngx from "@/widgets/paperlessngx/widget";
import peanut from "@/widgets/peanut/widget";
import pfsense from "@/widgets/pfsense/widget";
import photoprism from "@/widgets/photoprism/widget";
import pihole from "@/widgets/pihole/widget";
import plantit from "@/widgets/plantit/widget";
import plex from "@/widgets/plex/widget";
import portainer from "@/widgets/portainer/widget";
import prometheus from "@/widgets/prometheus/widget";
import prometheusmetric from "@/widgets/prometheusmetric/widget";
import prowlarr from "@/widgets/prowlarr/widget";
import proxmox from "@/widgets/proxmox/widget";
import proxmoxbackupserver from "@/widgets/proxmoxbackupserver/widget";
import pterodactyl from "@/widgets/pterodactyl/widget";
import pulse from "@/widgets/pulse/widget";
import pyload from "@/widgets/pyload/widget";
import qbittorrent from "@/widgets/qbittorrent/widget";
import qnap from "@/widgets/qnap/widget";
import qui from "@/widgets/qui/widget";
import radarr from "@/widgets/radarr/widget";
import readarr from "@/widgets/readarr/widget";
import releases from "@/widgets/releases/widget";
import romm from "@/widgets/romm/widget";
import rutorrent from "@/widgets/rutorrent/widget";
import sabnzbd from "@/widgets/sabnzbd/widget";
import scrutiny from "@/widgets/scrutiny/widget";
import seerr from "@/widgets/seerr/widget";
import slskd from "@/widgets/slskd/widget";
import sonarr from "@/widgets/sonarr/widget";
import sparkyfitness from "@/widgets/sparkyfitness/widget";
import speedtest from "@/widgets/speedtest/widget";
import spoolman from "@/widgets/spoolman/widget";
import sportarr from "@/widgets/sportarr/widget";
import stash from "@/widgets/stash/widget";
import stocks from "@/widgets/stocks/widget";
import strelaysrv from "@/widgets/strelaysrv/widget";
import suwayomi from "@/widgets/suwayomi/widget";
import swagdashboard from "@/widgets/swagdashboard/widget";
import syncthing from "@/widgets/syncthing/widget";
import tailscale from "@/widgets/tailscale/widget";
import tandoor from "@/widgets/tandoor/widget";
import tautulli from "@/widgets/tautulli/widget";
import tdarr from "@/widgets/tdarr/widget";
import technitium from "@/widgets/technitium/widget";
import tracearr from "@/widgets/tracearr/widget";
import traefik from "@/widgets/traefik/widget";
import transmission from "@/widgets/transmission/widget";
import trilium from "@/widgets/trilium/widget";
import truenas from "@/widgets/truenas/widget";
import tubearchivist from "@/widgets/tubearchivist/widget";
import unifi from "@/widgets/unifi/widget";
import unifi_drive from "@/widgets/unifi_drive/widget";
import unmanic from "@/widgets/unmanic/widget";
import unraid from "@/widgets/unraid/widget";
import uptimekuma from "@/widgets/uptimekuma/widget";
import uptimerobot from "@/widgets/uptimerobot/widget";
import urbackup from "@/widgets/urbackup/widget";
import vikunja from "@/widgets/vikunja/widget";
import wallos from "@/widgets/wallos/widget";
import watchtower from "@/widgets/watchtower/widget";
import wgeasy from "@/widgets/wgeasy/widget";
import whatsupdocker from "@/widgets/whatsupdocker/widget";
import xteve from "@/widgets/xteve/widget";
import yourspotify from "@/widgets/yourspotify/widget";
import zabbix from "@/widgets/zabbix/widget";

const widgets: Record<string, WidgetDefinition> = {
    adguard,
    apcups,
    arcane,
    argocd,
    atsumeru,
    audiobookshelf,
    authentik,
    autobrr,
    azuredevops,
    backrest,
    bazarr,
    booklore,
    bookorbit,
    beszel,
    caddy,
    calibreweb,
    changedetectionio,
    channelsdvrserver,
    checkmk,
    cloudflared,
    coinmarketcap,
    crowdsec,
    customapi,
    deluge,
    develancacheui,
    diskstation,
    duplicati,
    dispatcharr,
    dockhand,
    downloadstation,
    emby,
    esphome,
    evcc,
    feed,
    filebrowser,
    fileflows,
    firefly,
    flood,
    freshrss,
    frigate,
    fritzbox,
    gamedig,
    gatus,
    ghostfolio,
    gitea,
    gitlab,
    glances,
    gluetun,
    gotify,
    grafana,
    hdhomerun,
    headscale,
    hoarder: karakeep,
    karakeep,
    homeassistant,
    homebox,
    homebridge,
    healthchecks,
    ical: calendar,
    immich,
    jackett,
    jdownloader,
    jellyfin,
    jellyseerr: seerr,
    jellystat,
    kavita,
    komga,
    komodo,
    kopia,
    lidarr,
    linkwarden,
    livestreamer,
    lubelogger,
    mailcow,
    maintainerr,
    mastodon,
    mealie,
    medusa,
    minecraft,
    miniflux,
    mikrotik,
    mjpeg,
    moonraker,
    mylar,
    myspeed,
    navidrome,
    netalertx,
    netbird,
    netdata,
    nextcloud,
    nextdns,
    npm,
    ntfy,
    nzbget,
    octoprint,
    omada,
    ombi,
    opendtu,
    opnsense,
    overseerr: seerr,
    openmediavault,
    openwrt,
    paperlessngx,
    pangolin,
    peanut,
    pfsense,
    photoprism,
    proxmoxbackupserver,
    pialert: netalertx,
    pihole,
    plantit,
    plex,
    portainer,
    prometheus,
    prometheusmetric,
    prowlarr,
    proxmox,
    pterodactyl,
    pulse,
    pyload,
    qbittorrent,
    qnap,
    qui,
    radarr,
    readarr,
    releases,
    romm,
    rutorrent,
    sabnzbd,
    scrutiny,
    seerr,
    slskd,
    sonarr,
    sparkyfitness,
    speedtest,
    spoolman,
    sportarr,
    stash,
    stocks,
    strelaysrv,
    swagdashboard,
    suwayomi,
    syncthing,
    tailscale,
    tandoor,
    tautulli,
    technitium,
    tdarr,
    tracearr,
    traefik,
    transmission,
    trilium,
    tubearchivist,
    truenas,
    unifi,
    unifi_console: unifi,
    unifi_drive,
    unmanic,
    unraid,
    uptimekuma,
    uptimerobot,
    urbackup,
    vikunja,
    wallos,
    watchtower,
    wgeasy,
    whatsupdocker,
    xteve,
    yourspotify,
    zabbix,
};

export default widgets;
