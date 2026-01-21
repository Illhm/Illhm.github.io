document.getElementById("year").textContent = new Date().getFullYear();
const playIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
const pauseIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 19h4V5H6zm8-14v14h4V5h-4z"/></svg>';
const SPOTDL_ENDPOINT = 'https://spotdl.zeabur.app/';
const SPOTDL_CACHE_KEY = 'spotdl-favorites-v1';
const SPOTDL_CACHE_TTL = 1000 * 60 * 60 * 24 * 7;
const SPOTDL_MAX_CONCURRENT = 6;
const SPOTDL_TIMEOUT_MS = 13000;
const spotdlRequests = new Map();
const spotdlLoadState = new WeakMap();
const spotdlQueue = [];
let spotdlActive = 0;
let currentAudio = null;
let spotdlCachePersistTimer = null;
const supportsIntersectionObserver = 'IntersectionObserver' in window;

function readSpotdlCache() {
  try {
    const raw = localStorage.getItem(SPOTDL_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('SpotDL cache reset', error);
    return {};
  }
}

const spotdlCache = readSpotdlCache();

function persistSpotdlCache() {
  if (spotdlCachePersistTimer) {
    clearTimeout(spotdlCachePersistTimer);
    spotdlCachePersistTimer = null;
  }
  try {
    localStorage.setItem(SPOTDL_CACHE_KEY, JSON.stringify(spotdlCache));
  } catch (error) {
    console.warn('SpotDL cache write failed', error);
  }
}

function schedulePersistSpotdlCache() {
  if (spotdlCachePersistTimer) {
    clearTimeout(spotdlCachePersistTimer);
  }
  spotdlCachePersistTimer = setTimeout(persistSpotdlCache, 300);
}

function getCachedTrack(spotifyUrl) {
  const cached = spotdlCache[spotifyUrl];
  if (!cached) return null;
  if (Date.now() - cached.fetchedAt > SPOTDL_CACHE_TTL) {
    return null;
  }
  return cached;
}

function updateTrackCache(spotifyUrl, data) {
  spotdlCache[spotifyUrl] = { ...data, fetchedAt: Date.now() };
  schedulePersistSpotdlCache();
}

function enqueueSpotdlRequest(task) {
  return new Promise((resolve, reject) => {
    spotdlQueue.push({ task, resolve, reject });
    processSpotdlQueue();
  });
}

function processSpotdlQueue() {
  if (spotdlActive >= SPOTDL_MAX_CONCURRENT) return;
  const next = spotdlQueue.shift();
  if (!next) return;
  spotdlActive += 1;
  Promise.resolve()
    .then(next.task)
    .then(next.resolve, next.reject)
    .finally(() => {
      spotdlActive -= 1;
      processSpotdlQueue();
    });
}

function extractSpotdlThumbnail(html, doc) {
  const metaImage = doc.querySelector('meta[property="og:image"]')?.content;
  if (metaImage) return metaImage;
  const matches = html.match(/https:\/\/i\.scdn\.co\/image\/[a-zA-Z0-9]+/g);
  return matches ? matches[0] : null;
}

function parseSpotdlTitle(doc) {
  const titleText =
    doc.querySelector('meta[property="og:title"]')?.content ||
    doc.querySelector('title')?.textContent;
  if (!titleText) return {};
  if (titleText.includes(' - ')) {
    const [title, artist] = titleText.split(' - ');
    return { title: title.trim(), artist: artist.trim() };
  }
  return { title: titleText.trim() };
}

function sanitizeMediaUrl(rawUrl) {
  if (!rawUrl) return '';
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch (error) {
    console.warn('Invalid media URL', rawUrl, error);
  }
  return '';
}

async function fetchSpotdlMetadata(spotifyUrl) {
  if (spotdlRequests.has(spotifyUrl)) {
    return spotdlRequests.get(spotifyUrl);
  }
  const request = enqueueSpotdlRequest(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SPOTDL_TIMEOUT_MS);
    return fetch(`${SPOTDL_ENDPOINT}?url=${encodeURIComponent(spotifyUrl)}`, {
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`SpotDL error ${response.status}`);
      }
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const source = doc.querySelector('source');
      const thumbnailUrl = extractSpotdlThumbnail(html, doc);
      return {
        audioUrl: sanitizeMediaUrl(source?.src),
        thumbnailUrl,
        ...parseSpotdlTitle(doc),
      };
    })
    .finally(() => {
      spotdlRequests.delete(spotifyUrl);
    });
  spotdlRequests.set(spotifyUrl, request);
  return request;
}

function setPlayerState(player, state, label, message) {
  player.classList.remove('is-loading', 'is-ready', 'is-error');
  if (state) {
    player.classList.add(`is-${state}`);
  }
  const statusTag = player.querySelector('[data-status]');
  if (statusTag && label) statusTag.textContent = label;
  const messageEl = player.querySelector('.status-message');
  if (messageEl) {
    messageEl.textContent = message || '';
  }
}

function applyTrackMetadata(player, data) {
  if (!data) return;
  const audio = player.querySelector('audio');
  const titleEl = player.querySelector('.music-title');
  const artistEl = player.querySelector('.music-artist');
  const cover = player.querySelector('.music-cover');
  const fallbackCover = player.dataset.fallbackCover;

  if (data.audioUrl) {
    audio.src = data.audioUrl;
  }
  if (titleEl && data.title) {
    titleEl.textContent = data.title;
  }
  if (artistEl && data.artist) {
    artistEl.textContent = data.artist;
  }
  if (cover && data.thumbnailUrl) {
    cover.src = data.thumbnailUrl;
    cover.alt = data.title ? `Sampul album ${data.title}` : cover.alt;
  } else if (cover && fallbackCover) {
    cover.src = fallbackCover;
  }
}

function updatePlayButtonState(player) {
  const audio = player.querySelector('audio');
  const btn = player.querySelector('.play-btn');
  if (!audio || !btn) return;
  const hasSource = Boolean(audio.src);
  btn.disabled = !hasSource;
  if (!hasSource) {
    btn.innerHTML = playIcon;
    btn.setAttribute('aria-label', 'Tidak tersedia');
  } else if (audio.paused) {
    btn.setAttribute('aria-label', 'Putar');
  }
}

async function refreshSpotdlTrack(player) {
  const spotifyUrl = player.dataset.spotifyUrl;
  if (!spotifyUrl) return;

  const audio = player.querySelector('audio');
  const btn = player.querySelector('.play-btn');
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('aria-label', 'Memuat');
  }
  setPlayerState(player, 'loading', 'Memuat...');
  try {
    const data = await fetchSpotdlMetadata(spotifyUrl);
    applyTrackMetadata(player, data);
    if (!data.audioUrl) {
      throw new Error('SpotDL preview missing');
    }
    updateTrackCache(spotifyUrl, data);
    setPlayerState(player, 'ready', 'Streaming');
  } catch (error) {
    console.error('Gagal memuat data SpotDL', error);
    setPlayerState(
      player,
      'error',
      'Offline',
      'Gunakan metadata cadangan.'
    );
  } finally {
    updatePlayButtonState(player);
  }
}

function ensureSpotdlLoaded(player) {
  const spotifyUrl = player.dataset.spotifyUrl;
  if (!spotifyUrl) return Promise.resolve(null);
  const cached = getCachedTrack(spotifyUrl);
  if (cached) {
    applyTrackMetadata(player, cached);
    setPlayerState(player, 'ready', 'Streaming');
    updatePlayButtonState(player);
    return Promise.resolve(cached);
  }
  if (spotdlLoadState.has(player)) {
    return spotdlLoadState.get(player);
  }
  const request = refreshSpotdlTrack(player).finally(() => {
    spotdlLoadState.delete(player);
  });
  spotdlLoadState.set(player, request);
  return request;
}

function pauseOtherAudio(audio) {
  if (currentAudio && currentAudio !== audio) {
    currentAudio.pause();
    const otherPlayer = currentAudio.closest('.music-player');
    const otherBtn = otherPlayer?.querySelector('.play-btn');
    if (otherBtn) {
      otherBtn.innerHTML = playIcon;
      otherBtn.setAttribute('aria-label', 'Putar');
    }
    currentAudio = null;
  }
}

function startPlayback(player) {
  const audio = player.querySelector('audio');
  const btn = player.querySelector('.play-btn');
  if (!audio?.src || !btn) return;
  pauseOtherAudio(audio);
  const playAttempt = audio.play();
  if (playAttempt?.catch) {
    playAttempt.catch(error => {
      console.warn('Playback failed', error);
      btn.innerHTML = playIcon;
      btn.setAttribute('aria-label', 'Putar');
      setPlayerState(
        player,
        'error',
        'Offline',
        'Preview tidak bisa diputar.'
      );
    });
  }
  btn.innerHTML = pauseIcon;
  btn.setAttribute('aria-label', 'Jeda');
  currentAudio = audio;
}

const musicObserver = supportsIntersectionObserver
  ? new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            ensureSpotdlLoaded(entry.target);
            musicObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '600px 0px' }
    )
  : null;

function createMusicPlayerElement(url) {
  const player = document.createElement('div');
  player.className = 'music-player';
  player.dataset.spotifyUrl = url;
  player.setAttribute('role', 'listitem');
  player.innerHTML = `
    <div class="music-main">
      <div class="album">
        <img class="music-cover" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' fill='%23333'/%3E%3C/svg%3E" alt="Album Art">
        <span class="spotify-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.163 17.354a.75.75 0 0 1-1.036.249c-2.84-1.738-6.418-2.132-10.621-1.171a.75.75 0 1 1-.342-1.462c4.55-1.062 8.463-.611 11.584 1.287a.75.75 0 0 1 .415.835zm1.48-3.294a.94.94 0 0 1-1.302.31c-3.247-1.99-8.208-2.57-12.051-1.414a.94.94 0 1 1-.558-1.804c4.27-1.32 9.703-.67 13.468 1.58a.94.94 0 0 1 .443 1.328zm.131-3.408c-3.633-2.156-9.14-2.352-12.421-1.29a1.13 1.13 0 1 1-.668-2.162c4.043-1.25 10.2-1.012 14.35 1.455a1.13 1.13 0 0 1-1.261 1.997z"/>
          </svg>
        </span>
        <button class="play-btn" aria-label="Putar">
          ${playIcon}
        </button>
      </div>
      <div class="track-details">
        <div class="track-head">
          <div>
            <h3 class="music-title">Loading...</h3>
            <p class="music-artist">...</p>
          </div>
          <span class="preview-tag" data-status>Memuat...</span>
        </div>
        <p class="track-meta">Spotify Track</p>
        <div class="music-actions">
          <a class="save-link" href="${url}" target="_blank" rel="noopener">Save on Spotify</a>
          <span class="status-message" aria-live="polite"></span>
        </div>
      </div>
    </div>
    <audio preload="none"></audio>
  `;
  return player;
}

function setupPlayer(player) {
  const audio = player.querySelector('audio');
  const btn = player.querySelector('.play-btn');
  const cover = player.querySelector('.music-cover');
  if (cover && !player.dataset.fallbackCover) {
    player.dataset.fallbackCover = cover.src;
  }

  const cached = getCachedTrack(player.dataset.spotifyUrl);
  if (cached) {
    applyTrackMetadata(player, cached);
    setPlayerState(player, 'ready', 'Streaming');
    updatePlayButtonState(player);
  } else if (musicObserver) {
    // Lazy load: Fetch metadata only when player is near viewport
    musicObserver.observe(player);
  } else {
    ensureSpotdlLoaded(player);
  }

  // User intent prefetch
  const intentHandler = () => ensureSpotdlLoaded(player);
  player.addEventListener('pointerenter', intentHandler, { once: true });
  player.addEventListener('touchstart', intentHandler, {
    once: true,
    passive: true,
  });

  btn.addEventListener('click', async () => {
    if (!audio.src) {
      btn.disabled = true;
      btn.setAttribute('aria-label', 'Memuat');
      setPlayerState(player, 'loading', 'Memuat...');
      player.dataset.pendingPlay = 'true';
      try {
        await ensureSpotdlLoaded(player);
      } finally {
        btn.disabled = false;
      }
      if (player.dataset.pendingPlay === 'true' && audio.src) {
        startPlayback(player);
      }
      player.dataset.pendingPlay = '';
      return;
    }
    if (audio.paused) {
      startPlayback(player);
    } else {
      audio.pause();
      btn.innerHTML = playIcon;
      btn.setAttribute('aria-label', 'Putar');
      currentAudio = null;
    }
  });
  audio.addEventListener('ended', () => {
    btn.innerHTML = playIcon;
    btn.setAttribute('aria-label', 'Putar');
    if (currentAudio === audio) currentAudio = null;
  });
  audio.addEventListener('error', () => {
    console.warn(`Playback failed for ${player.dataset.spotifyUrl}`);
    const spotifyUrl = player.dataset.spotifyUrl;
    if (spotdlCache[spotifyUrl]) {
      delete spotdlCache[spotifyUrl];
      schedulePersistSpotdlCache();
    }
    audio.removeAttribute('src');
    btn.innerHTML = playIcon;
    btn.setAttribute('aria-label', 'Putar');
    btn.disabled = false;
    setPlayerState(
      player,
      'error',
      'Gagal',
      'Gagal memuat. Klik untuk coba lagi.'
    );
  });
}

async function loadPlaylist() {
  try {
    const response = await fetch('data/url.txt');
    if (!response.ok) throw new Error('Failed to load playlist');
    const text = await response.text();
    const urls = [...new Set(text.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')))]
      .slice(0, 50);

    if (urls.length === 0) return;

    // Featured Track
    const featuredUrl = urls[0];
    const trackIdMatch = featuredUrl.match(/(?:spotify:track:|track\/)([a-zA-Z0-9]+)/);
    if (trackIdMatch) {
      const trackId = trackIdMatch[1];
      const iframe = document.querySelector('.spotify-embed iframe');
      if (iframe) {
        iframe.src = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator`;
        const saveLink = document.querySelector('.spotify-button');
        if (saveLink) saveLink.href = featuredUrl;
      }
    }

    // Generate List
    const listContainer = document.querySelector('.music-list');
    listContainer.innerHTML = '';

    urls.forEach(url => {
      // Validate URL format (simple check)
      if (!url.includes('spotify.com/track/') && !url.includes('spotify:track:')) {
         console.warn('Skipping invalid Spotify URL:', url);
         return;
      }
      const player = createMusicPlayerElement(url);
      listContainer.appendChild(player);
      setupPlayer(player);
    });

  } catch (error) {
    console.error('Error loading playlist:', error);
    const listContainer = document.querySelector('.music-list');
    if (listContainer) {
       listContainer.innerHTML = '<p style="padding: 1rem; color: #888;">Gagal memuat playlist.</p>';
    }
  }
}

loadPlaylist();

window.addEventListener('pagehide', persistSpotdlCache);
window.addEventListener('beforeunload', persistSpotdlCache);

const DEFAULT_GALLERY_OWNER = 'Illhm';
const DEFAULT_GALLERY_REPO = 'Illhm.github.io';

function resolveGalleryRepo(container) {
  const dataOwner = container.dataset.owner;
  const dataRepo = container.dataset.repo;
  if (dataOwner && dataRepo) {
    return { owner: dataOwner, repo: dataRepo };
  }

  const host = window.location.hostname;
  if (host.endsWith('.github.io')) {
    const owner = host.split('.')[0];
    return { owner, repo: `${owner}.github.io` };
  }

  return { owner: DEFAULT_GALLERY_OWNER, repo: DEFAULT_GALLERY_REPO };
}

function getOptimizedImageUrl(url) {
  const cleanUrl = url.replace(/^https?:\/\//, '');
  const proxyUrl = new URL('https://images.weserv.nl/');
  proxyUrl.searchParams.set('url', cleanUrl);
  proxyUrl.searchParams.set('w', '900');
  proxyUrl.searchParams.set('q', '70');
  proxyUrl.searchParams.set('output', 'webp');
  return proxyUrl.toString();
}

async function loadGallery() {
  const container = document.getElementById('gallery');
  if (!container) return;

  const { owner, repo } = resolveGalleryRepo(container);
  const observer = supportsIntersectionObserver
    ? new IntersectionObserver(
        entries => {
          entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const img = entry.target;
            const dataSrc = img.dataset.src;
            if (dataSrc && img.src !== dataSrc) {
              img.src = dataSrc;
            }
            observer.unobserve(img);
          });
        },
        { rootMargin: '200px' }
      )
    : null;

  try {
    const res = await fetch('gallery.json');
    if (!res.ok) {
      throw new Error(`Failed to load gallery data: ${res.status}`);
    }
    const files = await res.json();
    if (!Array.isArray(files)) return;

    // Sort files by name if needed, assuming the JSON order is what we want or we sort here
    files
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(file => {
        const img = document.createElement('img');
        // Construct full URL. We assume the site is hosted at root or we need to handle base path.
        // For static sites, using relative path from JSON is usually best if it's relative to root.
        // The JSON has "gallery/img_XX.jpg".

        // We still want to use weserv.nl for optimization?
        // Weserv needs a public URL. If we are on localhost, it won't work.
        // If we are on GitHub Pages, we can construct the public URL.

        const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        let fullUrl = file.path;

        if (!fullUrl.startsWith('http')) {
           // Construct absolute URL for weserv
           // If on github pages: https://{owner}.github.io/{repo}/{path}
           // But we might be on a custom domain or subdirectory.
           // A safe bet for weserv is to provide the full absolute URL.
           fullUrl = new URL(file.path, window.location.href).href;
        }

        const optimizedUrl = isLocalhost ? file.path : getOptimizedImageUrl(fullUrl);

        img.dataset.src = optimizedUrl;
        img.dataset.fullSrc = file.path; // Use local path as fallback/full src
        img.alt = file.name;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.fetchPriority = 'low';
        img.draggable = false;

        img.addEventListener('error', () => {
          if (img.src !== img.dataset.fullSrc) {
            img.src = img.dataset.fullSrc;
          }
        });
        container.appendChild(img);
        if (observer) {
          observer.observe(img);
        } else if (img.dataset.src) {
          img.src = img.dataset.src;
        }
      });
  } catch (err) {
    console.error('Failed to load gallery', err);
    container.innerHTML = '<p style="color: #888; padding: 10px;">Gagal memuat galeri.</p>';
  }
}
loadGallery();

// Scroll Reveal Animation
if (supportsIntersectionObserver) {
  const animateObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        animateObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.05, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('[data-animate]').forEach(el => {
    animateObserver.observe(el);
  });
} else {
  document.querySelectorAll('[data-animate]').forEach(el => {
    el.classList.add('in-view');
  });
}
