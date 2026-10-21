
const API = "https://api.jikan.moe/v4";

const animeGrid = document.getElementById("anime-grid");
const animeSearch = document.getElementById("anime-search");
const genreFilter = document.getElementById("genre-filter");
const typeFilter = document.getElementById("type-filter");
const resultsTitle = document.getElementById("results-title");
const resultsCount = document.getElementById("results-count");
const loadMoreButton = document.getElementById("load-more");

const animeDialog = document.getElementById("anime-dialog");
const animeDetails = document.getElementById("anime-details");
const characterDialog = document.getElementById("character-dialog");
const characterDetails = document.getElementById("character-details");

let currentPage = 1;
let currentAnime = [];
let currentSearch = "";
let currentGenre = "";
let currentType = "";
let isLoading = false;
let hasNextPage = false;
let requestNumber = 0;
let searchTimer;

// Escape API-provided strings before placing them in HTML.
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function imageURL(item) {
  return item?.images?.webp?.large_image_url ||
         item?.images?.jpg?.large_image_url ||
         item?.images?.jpg?.image_url ||
         "";
}

function getGenres(item) {
  return (item.genres || []).map(genre => genre.name);
}

function showMessage(message, isError = false) {
  animeGrid.innerHTML = `
    <div class="${isError ? "error-state" : "loading-state"}">
      ${escapeHTML(message)}
      ${isError ? '<br><button class="button secondary" id="retry-button">Try again</button>' : ""}
    </div>
  `;

  document.getElementById("retry-button")?.addEventListener("click", () => {
    loadAnime(currentPage === 1 ? false : true);
  });
}

let lastRequestTime = 0;

async function fetchJSON(url) {
  // Keep API requests at least 400 ms apart.
  const now = Date.now();
  const wait = Math.max(0, 400 - (now - lastRequestTime));

  if (wait > 0) {
    await new Promise(resolve => setTimeout(resolve, wait));
  }

  lastRequestTime = Date.now();

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "API rate limit reached. Wait a few seconds and try again."
      );
    }

    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}


function buildAnimeURL(page = 1) {
  const params = new URLSearchParams({
    page: String(page),
    limit: "24",
    sfw: "true"
  });

  if (currentSearch) {
    params.set("q", currentSearch);
    params.set("order_by", "popularity");
    params.set("sort", "asc");
  } else {
    params.set("order_by", "score");
    params.set("sort", "desc");
  }

  if (currentGenre) params.set("genres", currentGenre);
  if (currentType) params.set("type", currentType);

  return `${API}/anime?${params.toString()}`;
}

async function loadAnime(loadNextPage = false) {
  if (loadNextPage && isLoading) return;

  isLoading = true;
  const thisRequest = ++requestNumber;

  if (!loadNextPage) {
    currentPage = 1;
    currentAnime = [];
    showMessage("Finding anime for you...");
    loadMoreButton.hidden = true;
  } else {
    loadMoreButton.disabled = true;
    loadMoreButton.textContent = "Loading...";
  }

  try {
    const data = await fetchJSON(buildAnimeURL(currentPage));

    // Ignore outdated responses if a new search has started.
    if (thisRequest !== requestNumber) return;

    const animeList = data.data || [];

    currentAnime = loadNextPage
      ? [...currentAnime, ...animeList]
      : animeList;

    hasNextPage = Boolean(data.pagination?.has_next_page);

    renderAnime(currentAnime);

    const filtersActive = Boolean(
      currentSearch || currentGenre || currentType
    );

    resultsTitle.textContent = currentSearch
      ? `Results for "${currentSearch}"`
      : filtersActive
        ? "Your Anime Picks"
        : "Popular Anime";

    resultsCount.textContent =
      `${currentAnime.length} anime loaded` +
      (hasNextPage ? " · More to discover" : "");

    loadMoreButton.hidden = !hasNextPage || currentAnime.length === 0;
  } catch (error) {
    if (thisRequest !== requestNumber) return;
    showMessage(error.message || "Could not load anime.", true);
  } finally {
    if (thisRequest === requestNumber) {
      isLoading = false;
      loadMoreButton.disabled = false;
      loadMoreButton.textContent = "Load More Anime ↓";
    }
  }
}

function renderAnime(animeList) {
  if (!animeList.length) {
    animeGrid.innerHTML = `
      <div class="empty-state">
        No anime found for these filters.<br>
        Try another genre, category, or search term.
      </div>
    `;
    return;
  }

  animeGrid.innerHTML = animeList.map((anime, index) => {
    const genres = getGenres(anime);
    const image = imageURL(anime);
    const title = anime.title_english || anime.title || "Untitled Anime";
    const score = anime.score ? `★ ${anime.score}` : "Not rated";
    const year = anime.year || anime.aired?.prop?.from?.year || "Year unknown";
    const type = anime.type || "Anime";

    return `
      <article class="anime-card">
        <div class="poster-wrap">
          <img
            class="poster"
            src="${escapeHTML(image)}"
            alt="${escapeHTML(title)} poster"
            loading="lazy"
            onerror="this.onerror=null;this.style.opacity='.2'"
          >
          <span class="score">${escapeHTML(score)}</span>
        </div>
        <div class="card-body">
          <span class="card-type">${escapeHTML(type)}</span>
          <h4 class="card-title">${escapeHTML(title)}</h4>
          <p class="card-genres">
            ${escapeHTML(genres.slice(0, 3).join(" · ") || "Genres unavailable")}
          </p>
          <div class="card-footer">
            <span>${escapeHTML(String(year))}</span>
            <button class="details-button" type="button" data-anime-index="${index}">
              View Details ↗
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

document.getElementById("filter-form").addEventListener("submit", event => {
  event.preventDefault();

  currentSearch = animeSearch.value.trim();
  currentGenre = genreFilter.value;
  currentType = typeFilter.value;

  loadAnime(false);
});

document.getElementById("reset-filters").addEventListener("click", () => {
  animeSearch.value = "";
  genreFilter.value = "";
  typeFilter.value = "";

  currentSearch = "";
  currentGenre = "";
  currentType = "";

  loadAnime(false);
});

loadMoreButton.addEventListener("click", () => {
  if (!hasNextPage || isLoading) return;

  currentPage += 1;
  loadAnime(true);
});

// Open the details dialog for a selected anime.
animeGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-anime-index]");
  if (!button) return;

  const anime = currentAnime[Number(button.dataset.animeIndex)];
  if (!anime) return;

  openAnimeDetails(anime);
});

function openAnimeDetails(anime) {
  const title = anime.title_english || anime.title || "Anime Details";
  const image = imageURL(anime);
  const genres = getGenres(anime);
  const synopsis = anime.synopsis || "No synopsis is available for this title.";
  const studios = (anime.studios || []).map(studio => studio.name);
  const themes = (anime.themes || []).map(theme => theme.name);
  const url = anime.url || "";
  const episodes = anime.episodes ?? "Unknown";
  const status = anime.status || "Unknown";

  animeDetails.innerHTML = `
    <div class="dialog-layout">
      <img class="dialog-poster" src="${escapeHTML(image)}"
        alt="${escapeHTML(title)} poster">
      <div class="dialog-content">
        <span class="eyebrow">${escapeHTML(anime.type || "ANIME")}</span>
        <h2>${escapeHTML(title)}</h2>
        <div class="dialog-meta">
          ${anime.score ? `<span>★ ${escapeHTML(anime.score)}</span>` : ""}
          <span>${escapeHTML(String(episodes))} episodes</span>
          <span>${escapeHTML(status)}</span>
        </div>
        <p>${escapeHTML(synopsis)}</p>
        <h4>Genres</h4>
        <div class="dialog-meta">
          ${genres.map(genre => `<span>${escapeHTML(genre)}</span>`).join("")}
        </div>
        ${studios.length ? `<p><strong>Studios:</strong> ${escapeHTML(studios.join(", "))}</p>` : ""}
        ${themes.length ? `<p><strong>Themes:</strong> ${escapeHTML(themes.join(", "))}</p>` : ""}
        ${url ? `<a class="dialog-link" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Explore full anime page ↗</a>` : ""}
      </div>
    </div>
  `;

  animeDialog.showModal();
}

// Character wiki search.
document.getElementById("character-form").addEventListener("submit", async event => {
  event.preventDefault();

  const query = document.getElementById("character-search").value.trim();
  const characterResults = document.getElementById("character-results");

  if (!query) return;

  characterResults.innerHTML =
    '<div class="loading-state">Searching the character universe...</div>';

  try {
    const params = new URLSearchParams({
      q: query,
      limit: "8"
    });

    const result = await fetchJSON(
      `${API}/characters?${params.toString()}`
    );

    renderCharacters(result.data || []);
  } catch (error) {
    characterResults.innerHTML = `
      <div class="error-state">${escapeHTML(error.message)}</div>
    `;
  }
});

function renderCharacters(characters) {
  const container = document.getElementById("character-results");

  if (!characters.length) {
    container.innerHTML = `
      <div class="wiki-empty">
        <span>✧</span>
        <p>No characters found. Try another name.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = characters.map(character => {
    const image = imageURL(character);
    const name = character.name || "Unknown character";
    const kanji = character.name_kanji || "";

    return `
      <article class="character-result">
        <img
          src="${escapeHTML(image)}"
          alt="${escapeHTML(name)}"
          loading="lazy"
          onerror="this.onerror=null;this.style.opacity='.2'"
        >
        <div class="character-result-info">
          <h4>${escapeHTML(name)}</h4>
          <p>${escapeHTML(kanji || "Anime character")}</p>
        </div>
        <button type="button" data-character-id="${Number(character.mal_id)}">
          Wiki ↗
        </button>
      </article>
    `;
  }).join("");
}

// Load the full biography only when a character is selected.
document.getElementById("character-results").addEventListener("click", async event => {
  const button = event.target.closest("[data-character-id]");
  if (!button) return;

  const id = Number(button.dataset.characterId);
  if (!Number.isSafeInteger(id) || id <= 0) return;

  characterDetails.innerHTML =
    '<div class="loading-state">Opening character wiki...</div>';

  characterDialog.showModal();

  try {
    const result = await fetchJSON(`${API}/characters/${id}/full`);
    renderCharacterDetails(result.data);
  } catch (error) {
    characterDetails.innerHTML = `
      <div class="error-state">${escapeHTML(error.message)}</div>
    `;
  }
});

function renderCharacterDetails(character) {
  const name = character.name || "Character Wiki";
  const image = imageURL(character);
  const about = character.about || "No biography is available for this character.";
  const url = character.url || "";

  const animeography = (character.anime || [])
    .slice(0, 8)
    .map(item => item.anime?.title)
    .filter(Boolean);

  const nicknames = character.nicknames || [];

  characterDetails.innerHTML = `
    <div class="character-dialog-layout">
      <img src="${escapeHTML(image)}" alt="${escapeHTML(name)}">
      <div>
        <span class="eyebrow">CHARACTER ENCYCLOPEDIA</span>
        <h2>${escapeHTML(name)}</h2>
        ${character.name_kanji
          ? `<p>${escapeHTML(character.name_kanji)}</p>`
          : ""}
        ${nicknames.length
          ? `<div class="dialog-meta">${nicknames.map(n =>
              `<span>${escapeHTML(n)}</span>`).join("")}</div>`
          : ""}
        <p>${escapeHTML(about)}</p>
        ${animeography.length
          ? `<h3>Anime Appearances</h3>
             <div class="character-appearances">
               ${animeography.map(title =>
                 `<span>${escapeHTML(title)}</span>`).join("")}
             </div>`
          : ""}
        ${url
          ? `<a class="dialog-link" href="${escapeHTML(url)}"
               target="_blank" rel="noopener noreferrer">
               View full character page ↗
             </a>`
          : ""}
      </div>
    </div>
  `;
}

// Close either dialog using its close button.
document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    button.closest("dialog").close();
  });
});

// Also close when the user clicks the dark backdrop.
document.querySelectorAll(".details-dialog").forEach(dialog => {
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
});

// Initial recommendations.
loadAnime(false);
