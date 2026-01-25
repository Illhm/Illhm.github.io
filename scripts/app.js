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
const defaultCover = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' fill='%23333'/%3E%3C/svg%3E";

let currentAudio = null;

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

      if (error.name === 'NotAllowedError') {
        const statusTag = player.querySelector('.preview-tag');
        if(statusTag) statusTag.textContent = "Ketuk lagi";
      }
    });
  }
  btn.innerHTML = pauseIcon;
  btn.setAttribute('aria-label', 'Jeda');
  currentAudio = audio;
}

function createMusicPlayerElement(track) {
  const player = document.createElement('div');
  player.className = 'music-player';
  player.setAttribute('role', 'listitem');

  const coverSrc = track.coverPath || defaultCover;

  player.innerHTML = `
    <div class="music-main">
      <div class="album">
        <img class="music-cover" src="${coverSrc}" alt="Album Art ${track.title}" loading="lazy">
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
            <h3 class="music-title">${track.title}</h3>
            <p class="music-artist">${track.artist}</p>
          </div>
          <span class="preview-tag">Local</span>
        </div>
        <div class="music-actions">
          <a class="save-link" href="${track.url}" target="_blank" rel="noopener">Save on Spotify</a>
        </div>
      </div>
    </div>
    <audio preload="none" src="${track.audioPath}"></audio>
  `;
  return player;
}

function setupPlayer(player) {
  const audio = player.querySelector('audio');
  const btn = player.querySelector('.play-btn');

  btn.addEventListener('click', () => {
    if (audio.paused) {
      startPlayback(player);
    } else {
      audio.pause();
      btn.innerHTML = playIcon;
      btn.setAttribute('aria-label', 'Putar');
      if (currentAudio === audio) currentAudio = null;
    }
  });

  audio.addEventListener('ended', () => {
    btn.innerHTML = playIcon;
    btn.setAttribute('aria-label', 'Putar');
    if (currentAudio === audio) currentAudio = null;
  });

  audio.addEventListener('error', (e) => {
    console.error(`Playback error`, audio.error);
    const statusTag = player.querySelector('.preview-tag');
    if(statusTag) statusTag.textContent = "Error";
    btn.disabled = true;
  });
}

async function loadLibrary() {
  const listContainer = document.querySelector('.music-list');
  try {
    const response = await fetch('music/library.json');
    if (!response.ok) throw new Error('Library not found');
    const tracks = await response.json();

    if (tracks.length === 0) {
        listContainer.innerHTML = '<p style="padding: 1rem; color: #888;">Belum ada lagu yang diunduh.</p>';
        return;
    }

    // Featured Track (First one)
    const featured = tracks[0];
    const iframe = document.querySelector('.spotify-embed iframe');
    if (iframe && featured.id) {
        iframe.src = `https://open.spotify.com/embed/track/${featured.id}?utm_source=generator`;
        const saveLink = document.querySelector('.spotify-button');
        if (saveLink) saveLink.href = featured.url;
    }

    listContainer.innerHTML = '';
    tracks.forEach(track => {
      const player = createMusicPlayerElement(track);
      listContainer.appendChild(player);
      setupPlayer(player);
    });

  } catch (error) {
    console.error('Error loading library:', error);
    listContainer.innerHTML = `
      <div style="padding: 1rem; color: #aaa;">
        <p>Playlist sedang disiapkan...</p>
        <p style="font-size: 0.8em; margin-top: 5px;">(Menunggu GitHub Action selesai mengunduh lagu)</p>
      </div>
    `;
  }
}

loadLibrary();

// Gallery Logic
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

    files
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(file => {
        const img = document.createElement('img');
        const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        let fullUrl = file.path;

        if (!fullUrl.startsWith('http')) {
           fullUrl = new URL(file.path, window.location.href).href;
        }

        const optimizedUrl = isLocalhost ? file.path : getOptimizedImageUrl(fullUrl);

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
