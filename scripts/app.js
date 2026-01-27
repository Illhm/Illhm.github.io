const supportsIntersectionObserver = 'IntersectionObserver' in window;

// Scroll Reveal Animation (Initialize first to prevent blank screen if other scripts fail)
function initScrollReveal() {
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
}
// Run immediately
initScrollReveal();

try {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
} catch (e) { console.warn("Year update failed", e); }

const playIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
const pauseIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 19h4V5H6zm8-14v14h4V5h-4z"/></svg>';
const SILENT_AUDIO = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAgZGF0YQQAAAAAAA==';

let currentAudio = null;
let localLibrary = {};

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
  const hasSource = Boolean(audio.src) && audio.src !== SILENT_AUDIO;
  btn.disabled = !hasSource;
  if (!hasSource) {
    btn.innerHTML = playIcon;
    btn.setAttribute('aria-label', 'Tidak tersedia');
  } else if (audio.paused) {
    btn.setAttribute('aria-label', 'Putar');
  }
}

function ensureTrackLoaded(player) {
  const spotifyUrl = player.dataset.spotifyUrl;
  if (!spotifyUrl) return Promise.resolve(null);

  if (localLibrary[spotifyUrl]) {
    const data = localLibrary[spotifyUrl];
    applyTrackMetadata(player, data);
    setPlayerState(player, 'ready', 'Local');
    updatePlayButtonState(player);
    return Promise.resolve(data);
  }

  // Track not in library.
  // We avoid showing an intrusive error here as per user preference.
  return Promise.resolve(null);
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

      // Check if audio.error is already set (handled by error listener)
      if (audio.error) return;

      if (error.name === 'NotAllowedError') {
        // Mobile/Browser policy blocked autoplay. User needs to tap again.
        // Metadata is loaded, so next tap will be synchronous and succeed.
        setPlayerState(player, 'ready', 'Ketuk lagi', 'Ketuk lagi untuk memutar.');
      }
      // Removed "Offline" error block.
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
            ensureTrackLoaded(entry.target);
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
            <path fill="currentColor" d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm5.163 17.354a.75.75 0 0 1-1.036.249c-2.84-1.738-6.418-2.132-10.621-1.171a.75.75 0 1 1-.342-1.462c4.55-1.062 8.463-.611 11.584 1.287a.75.75 0 0 1 .415.835zm1.48-3.294a.94.94 0 0 1-1.302.31c-3.247-1.99-8.208-2.57-12.051-1.416a.94.94 0 1 1-.558-1.804c4.27-1.32 9.703-.67 13.468 1.58a.94.94 0 0 1 .443 1.328zm.131-3.408c-3.633-2.156-9.14-2.352-12.421-1.29a1.13 1.13 0 1 1-.668-2.162c4.043-1.25 10.2-1.012 14.35 1.455a1.13 1.13 0 0 1-1.261 1.997z"/>
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
    <audio preload="none" referrerpolicy="no-referrer"></audio>
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

  if (musicObserver) {
    // Lazy load: Fetch metadata only when player is near viewport
    musicObserver.observe(player);
  } else {
    ensureTrackLoaded(player);
  }

  // User intent prefetch
  const intentHandler = () => ensureTrackLoaded(player);
  player.addEventListener('pointerenter', intentHandler, { once: true });
  player.addEventListener('touchstart', intentHandler, {
    once: true,
    passive: true,
  });

  btn.addEventListener('click', async () => {
    if (!audio.src || audio.src === SILENT_AUDIO) {
      audio.src = SILENT_AUDIO;
      audio.play().catch(() => {});
      btn.disabled = true;
      btn.setAttribute('aria-label', 'Memuat');
      setPlayerState(player, 'loading', 'Memuat...');
      player.dataset.pendingPlay = 'true';
      try {
        await ensureTrackLoaded(player);
      } finally {
        btn.disabled = false;
      }
      if (player.dataset.pendingPlay === 'true' && audio.src && audio.src !== SILENT_AUDIO) {
        startPlayback(player);
      } else if (audio.src === SILENT_AUDIO) {
        audio.removeAttribute('src');
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
  audio.addEventListener('error', (e) => {
    const err = audio.error;
    let errDesc = 'Unknown';
    if (err) {
      switch (err.code) {
        case 1: errDesc = 'Aborted'; break;
        case 2: errDesc = 'Network'; break;
        case 3: errDesc = 'Decode'; break;
        case 4: errDesc = 'Src Not Supported'; break;
      }
    }
    console.error(`[PlaybackError] ${player.dataset.spotifyUrl} - Code: ${err?.code} (${errDesc})`);

    audio.removeAttribute('src');
    btn.innerHTML = playIcon;
    btn.setAttribute('aria-label', 'Putar');
    btn.disabled = false;

    setPlayerState(
      player,
      'error',
      'Gagal',
      `Error: ${errDesc}. Klik untuk retry.`
    );
  });
}

async function loadPlaylist() {
  try {
    try {
      const libRes = await fetch('music/library.json');
      if (libRes.ok) {
        const libData = await libRes.json();
        libData.forEach(item => {
          localLibrary[item.spotify_url] = {
            title: item.title,
            artist: item.artist,
            audioUrl: item.audio_path,
            thumbnailUrl: item.cover_path,
            source: 'local'
          };
        });
        console.log('Local library loaded', Object.keys(localLibrary).length);
      }
    } catch (e) {
      console.warn('Local library not found or invalid');
    }

    const response = await fetch('data/url.txt');
    if (!response.ok) throw new Error('Failed to load playlist');
    const text = await response.text();
    const urls = [];
    const seen = new Set();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#') && !seen.has(line)) {
        seen.add(line);
        urls.push(line);
        if (urls.length >= 50) break;
      }
    }

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

    const fragment = document.createDocumentFragment();
    urls.forEach(url => {
      // Validate URL format (simple check)
      if (!url.includes('spotify.com/track/') && !url.includes('spotify:track:')) {
         console.warn('Skipping invalid Spotify URL:', url);
         return;
      }
      const player = createMusicPlayerElement(url);
      fragment.appendChild(player);
      setupPlayer(player);
    });
    listContainer.appendChild(fragment);

  } catch (error) {
    console.error('Error loading playlist:', error);
    const listContainer = document.querySelector('.music-list');
    if (listContainer) {
       listContainer.innerHTML = '<p style="padding: 1rem; color: #888;">Gagal memuat playlist.</p>';
    }
  }
}

loadPlaylist();

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

    const fragment = document.createDocumentFragment();
    const hostname = window.location.hostname;
    const isLocalNetwork =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.endsWith('.local');

    files
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(file => {
        const img = document.createElement('img');

        let fullUrl = file.path;
        if (!fullUrl.startsWith('http')) {
           fullUrl = new URL(file.path, window.location.href).href;
        }

        const optimizedUrl = isLocalNetwork ? file.path : getOptimizedImageUrl(fullUrl);

        img.dataset.src = optimizedUrl;
        img.dataset.fullSrc = file.path;
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
        fragment.appendChild(img);
        if (observer) {
          observer.observe(img);
        } else if (img.dataset.src) {
          img.src = img.dataset.src;
        }
      });
    container.appendChild(fragment);
  } catch (err) {
    console.error('Failed to load gallery', err);
    container.innerHTML = '<p style="color: #888; padding: 10px;">Gagal memuat galeri.</p>';
  }
}
loadGallery();

// Typewriter Effect
class Typewriter {
  constructor(el, phrases, period = 2000) {
    this.el = el;
    this.phrases = phrases;
    this.period = period;
    this.loopNum = 0;
    this.txt = '';
    this.isDeleting = false;
    this.tick();
  }

  tick() {
    const i = this.loopNum % this.phrases.length;
    const fullTxt = this.phrases[i];

    if (this.isDeleting) {
      this.txt = fullTxt.substring(0, this.txt.length - 1);
    } else {
      this.txt = fullTxt.substring(0, this.txt.length + 1);
    }

    this.el.textContent = this.txt;

    let delta = 150 - Math.random() * 100;

    if (this.isDeleting) { delta /= 2; }

    if (!this.isDeleting && this.txt === fullTxt) {
      delta = this.period;
      this.isDeleting = true;
    } else if (this.isDeleting && this.txt === '') {
      this.isDeleting = false;
      this.loopNum++;
      delta = 500;
    }

    setTimeout(() => this.tick(), delta);
  }
}

const typingElement = document.getElementById('typing-text');
if (typingElement) {
  new Typewriter(typingElement, [
    ' • PT HANDAL SUKSES KARYA',
    ' • Rembang',
    ' • Web Enthusiast',
    ' • Music Lover'
  ]);
}
