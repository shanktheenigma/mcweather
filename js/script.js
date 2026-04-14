let geoCodingAPI = "https://geocoding-api.open-meteo.com/v1/search";
let weatherAPI =
  "https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant&hourly=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,wind_direction_10m&current=temperature_2m,is_day,relative_humidity_2m,rain,snowfall,weather_code,wind_speed_10m,wind_direction_10m&minutely_15=temperature_2m,relative_humidity_2m,rain,weather_code,wind_speed_10m,wind_direction_10m,is_day";

let isNightMode = false;
let windParticles = [];
let windCanvas, windCtx;
let animFrame;

// Setting up weather info with code from API
function weatherInfo(code, isDay) {
  if (code === 0) {
    return isDay
      ? { label: "Clear Sky", icon: "clear-day", mood: "sunny" }
      : { label: "Clear Night", icon: "clear-night", mood: "clear-night" };
  }
  if (code <= 2) {
    return isDay
      ? { label: "Partly Cloudy", icon: "overcast-day", mood: "cloudy" }
      : {
          label: "Partly Cloudy",
          icon: "partly-cloudy-night",
          mood: "clear-night",
        };
  }
  if (code === 3)
    return { label: "Overcast", icon: "overcast-day", mood: "cloudy" };
  if (code <= 49) return { label: "Foggy", icon: "fog", mood: "cloudy" };
  if (code <= 59) return { label: "Drizzle", icon: "drizzle", mood: "rain" };
  if (code <= 69) return { label: "Rain", icon: "rain", mood: "rain" };
  if (code <= 79) return { label: "Snow", icon: "snow", mood: "snow" };
  if (code <= 94)
    return { label: "Storm", icon: "thunderstorms", mood: "thunder" };
  return { label: "Unknown", icon: "cloudy", mood: "cloudy" };
}

function getMoodBg(mood, forceNight) {
  if (forceNight) return "var(--bg-night)";
  const map = {
    sunny: "var(--bg-sunny)",
    cloudy: "var(--bg-cloudy)",
    rain: "var(--bg-rain)",
    snow: "var(--bg-snow)",
    thunder: "var(--bg-thunder)",
    "clear-night": "var(--bg-clear-night)",
  };
  return map[mood] || "var(--bg-cloudy)";
}

// Weather effect
function updateEffects(mood) {
  const starsOverlay = document.getElementById("stars-overlay");
  const rainOverlay = document.getElementById("rain-overlay");
  starsOverlay.classList.toggle("visible", mood === "clear-night");
  rainOverlay.classList.toggle(
    "visible",
    mood === "rain" || mood === "thunder",
  );
  if (mood === "clear-night" && !starsOverlay.children.length) buildStars();
  if ((mood === "rain" || mood === "thunder") && !rainOverlay.children.length)
    buildRain();
}

function getWindDir(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

// Humidity description based on humidity percent
function getHumidityDesc(h) {
  if (h < 40) return "Dry air — comfortable";
  if (h < 50) return "Ideal — comfortable and healthy";
  if (h < 70) return "Moderate humidity";
  return "High humidity — feels sticky";
}

// Icon setting based on hourly weather code
function hourlyInfo(code) {
  if (code === 0) return { icon: "clear-day" };
  if (code <= 2) return { icon: "partly-cloudy-night" };
  if (code === 3) return { icon: "overcast-day" };
  if (code <= 49) return { icon: "fog" };
  if (code <= 59) return { icon: "drizzle" };
  if (code <= 69) return { icon: "rain" };
  if (code <= 79) return { icon: "snow" };
  if (code <= 94) return { icon: "thunderstorms" };
  return { icon: "cloudy" };
}

// Clothing suggestions
function getClothingSuggestions(temp, weatherCode, humidity) {
  const suggestions = [];

  if (temp <= 0) {
    suggestions.push("Heavy winter coat essential");
    suggestions.push("Thermal layers recommended");
    suggestions.push("Gloves, scarf and hat needed");
  } else if (temp <= 8) {
    suggestions.push("Warm coat and layers");
    suggestions.push("Scarf and gloves advised");
  } else if (temp <= 14) {
    suggestions.push("Light jacket or hoodie");
    suggestions.push("Long sleeves recommended");
  } else if (temp <= 20) {
    suggestions.push("Light clothing with a layer");
    suggestions.push("A cardigan or light jacket");
  } else if (temp <= 27) {
    suggestions.push("Light clothing recommended");
    suggestions.push("T-shirt and shorts weather");
  } else {
    suggestions.push("Very light clothing only");
    suggestions.push("Stay in the shade if possible");
  }

  if (weatherCode >= 51 && weatherCode <= 69) {
    suggestions.push("Bring an umbrella");
    suggestions.push("Waterproof shoes advised");
  } else if (weatherCode >= 71 && weatherCode <= 79) {
    suggestions.push("Waterproof boots needed");
    suggestions.push("Snow gear if going out");
  } else if (weatherCode >= 80 && weatherCode <= 94) {
    suggestions.push("Rain jacket essential");
    suggestions.push("Avoid open areas — storms");
  } else if (weatherCode === 0 && temp > 18) {
    suggestions.push("Sunglasses recommended");
    suggestions.push("Sunscreen if outside long");
  }

  if (humidity >= 80) {
    suggestions.push("Breathable fabrics advised");
  } else if (humidity < 30) {
    suggestions.push("Stay hydrated — dry air");
  }

  return [...new Set(suggestions)].slice(0, 3);
}

// ---- Place suggestions from places.json ----
let placesData = null;

async function loadPlacesData() {
  if (placesData) return placesData;
  try {
    const res = await fetch("data/placeSuggestion.json");
    placesData = await res.json();
  } catch (err) {
    console.error("Could not load places.json:", err);
    placesData = { cities: [] };
  }
  return placesData;
}

function getPlaceSuggestions(weatherCode, temp, isDay, cityName) {
  if (!placesData || !placesData.cities.length)
    return getFallbackPlaces(weatherCode, temp, isDay);

  const normalised = cityName?.toLowerCase() ?? "";
  const match = placesData.cities.find(
    (c) =>
      normalised.includes(c.name.toLowerCase()) ||
      c.name.toLowerCase().includes(normalised.split(",")[0].trim()),
  );

  const pool = match
    ? !isDay
      ? match.night
      : weatherCode >= 51 || temp < 8
        ? match.indoor
        : match.outdoor
    : getFallbackPlaces(weatherCode, temp, isDay);

  return pool.sort(() => Math.random() - 0.5).slice(0, 3);
}

function getFallbackPlaces(weatherCode, temp, isDay) {
  const outdoor = [
    { place: "City Park", desc: "Great weather for a walk outside" },
    { place: "Botanical Garden", desc: "Perfect conditions for exploring" },
    { place: "Waterfront Promenade", desc: "Enjoy the fresh air by the water" },
    { place: "Open-air Market", desc: "Ideal day to browse local stalls" },
    { place: "Rooftop Café", desc: "Clear skies, great views await" },
    { place: "Cycling Trail", desc: "Hop on a bike and enjoy the ride" },
  ];
  const indoor = [
    { place: "Museum of Art", desc: "Perfect day to explore indoors" },
    { place: "Local Cinema", desc: "Catch a film and stay dry" },
    { place: "Cosy Café", desc: "Warm up with a hot drink" },
    { place: "Shopping Centre", desc: "Stay comfortable and explore" },
    { place: "Aquarium", desc: "Fascinating for all ages indoors" },
    { place: "Indoor Gallery", desc: "Discover local art and culture" },
  ];
  const night = [
    { place: "Rooftop Bar", desc: "Great night for city views" },
    { place: "Jazz Club", desc: "Enjoy live music tonight" },
    { place: "Night Market", desc: "Street food and evening vibes" },
    { place: "Planetarium", desc: "Clear skies — perfect for stargazing" },
  ];
  const pool = !isDay
    ? night
    : weatherCode >= 51 || temp < 8
      ? indoor
      : outdoor;
  return pool.sort(() => Math.random() - 0.5).slice(0, 3);
}

// Converting the cityname into latitude and longitude, and replace in the weather URL
async function searchCity(cityName) {
  load(true);
  try {
    const cityResult = await fetch(
      `${geoCodingAPI}?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`,
    );
    if (!cityResult.ok) throw new Error("Geocoding failed");

    const data = await cityResult.json();

    if (!data.results || data.results.length === 0) {
      alert(`City "${cityName}" not found. Try another one.`);
      return;
    }

    const { latitude, longitude, name, country } = data.results[0];
    localStorage.setItem("lastCity", name);

    const cityEl = document.querySelector(".city");
    if (cityEl) cityEl.innerText = `${name}, ${country}`;

    weatherAPI =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant` +
      `&hourly=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,wind_direction_10m` +
      `&current=temperature_2m,is_day,relative_humidity_2m,rain,snowfall,weather_code,wind_speed_10m,wind_direction_10m` +
      `&minutely_15=temperature_2m,relative_humidity_2m,rain,weather_code,wind_speed_10m,wind_direction_10m,is_day`;

    fetchWeather();
  } catch (err) {
    console.error("Search error:", err);
    alert("Could not find weather for that city.");
  }
  load(false);
}

// Handling Searches
function handleSearch() {
  const input = document.getElementById("search");
  const city = input.value.trim();
  if (city) searchCity(city);
}

// Loading handler
function load(visible) {
  document.getElementById("loading-overlay").classList.toggle("show", visible);
}

// ---- Rendering weather (async to support places.json) ----
async function renderWeather(data) {
  const c = data.current;
  const humidity = c.relative_humidity_2m;
  const currentTemp = c.temperature_2m;
  const hourlyTemps = data.hourly.temperature_2m;
  const windSpeed = Math.round(c.wind_speed_10m);
  const windDir = c.wind_direction_10m;

  const isDay = c.is_day === 1;
  const wInfo = weatherInfo(c.weather_code, isDay);
  const mood = isNightMode ? "clear-night" : wInfo.mood;

  document.body.style.background = getMoodBg(mood, isNightMode);
  updateEffects(mood);

  // Save action
  const saveBtn = document.querySelector(".saveBtn button");
  if (saveBtn) {
    saveBtn.onclick = () => {
      const cityEl = document.querySelector(".city");
      const cityText = cityEl ? cityEl.innerText : "Unknown";
      const now = new Date();
      const timeStr = now.toLocaleString("en", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const entry = {
        city: cityText,
        cityRaw: cityText.split(",")[0].trim(),
        time: timeStr,
        temp: `${currentTemp}°C`,
        label: wInfo.label,
        icon: wInfo.icon,
      };
      const arr = getSaved();
      const alreadySaved = arr.some((s) => s.city === cityText);
      if (!alreadySaved) {
        arr.unshift(entry);
        setSaved(arr);
        saveBtn.textContent = "Saved";
        setTimeout(() => (saveBtn.textContent = "Save"), 2000);
      } else {
        saveBtn.textContent = "Already saved";
        setTimeout(() => (saveBtn.textContent = "Save"), 2000);
      }
    };
  }

  // Current Temperature
  const currentEl = document.getElementById("currentTemp");
  if (currentEl) currentEl.innerText = `${currentTemp}°C`;

  const weather = document.querySelector(".weather");
  if (weather) {
    weather.innerHTML = `
      <div class="currentTime" id="currentTime"></div>
      <div class="estTemp">
        ${currentTemp}°C
        <img class="weatherIcon"
          src="https://bmcdn.nl/assets/weather-icons/v3.0/fill/svg/${wInfo.icon}.svg">
      </div>
      <div class="estWeather">${wInfo.label}</div>
    `;

    if (window._clockInterval) clearInterval(window._clockInterval);

    function updateClock() {
      const el = document.getElementById("currentTime");
      if (!el) {
        clearInterval(window._clockInterval);
        return;
      }
      const now = new Date();
      const day = now.toLocaleString("en", { weekday: "long" });
      const date = now.toLocaleString("en", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const time = now.toLocaleString("en", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      el.textContent = `${day}, ${date} · ${time}`;
    }

    updateClock();
    window._clockInterval = setInterval(updateClock, 1000);
  }

  // Clothing suggestions
  const suggestionGroup = document.querySelector(".suggestionGroup");
  if (suggestionGroup) {
    const suggestions = getClothingSuggestions(
      currentTemp,
      c.weather_code,
      humidity,
    );
    suggestionGroup.innerHTML = suggestions
      .map((s) => `<div class="suggestion">${s}</div>`)
      .join("");
  }

  // Humidity
  const estHumidity = document.querySelector(".estHumidity");
  estHumidity.innerHTML = `
    <div class="value">${humidity}%</div>
    <div class="humidity-bar">
      <div class="humidity-fill"></div>
    </div>
    <div class="desc">${getHumidityDesc(humidity)}</div>
  `;
  const humidityFill = document.querySelector(".humidity-fill");
  if (humidityFill) humidityFill.style.width = `${humidity}%`;

  // Average Temperature
  const sum = hourlyTemps.reduce((total, temp) => total + temp, 0);
  const avgTemp = sum / hourlyTemps.length;
  const atd = currentTemp - avgTemp;
  const averageTemp = document.querySelector(".avgTemp");
  averageTemp.innerHTML = `${avgTemp.toFixed(1)}°C
    <div class="avgTDescription"><span>${atd.toFixed(1)}°C</span> higher than Average Temperature</div>`;

  // Wind Canvas
  const windCard = document.getElementById("wind-card");
  windCard.innerHTML = `
    <div class="windInfo">
      <div class="statLabel">Wind</div>
      <div class="windSpeed">${windSpeed}<span class="kmp">km/h</span></div>
      <span>Direction: ${getWindDir(windDir)}</span>
      <span>${windDir}°</span>
    </div>
    <div class="wind-animation">
      <canvas id="wind-canvas"></canvas>
    </div>
  `;

  // Hourly forecast
  const hourlyF = document.querySelector(".hForecastCards");
  if (!hourlyF) return;
  hourlyF.innerHTML = "";

  for (let i = 0; i < 24; i++) {
    const code = data.hourly.weather_code[i];
    const hInfo = hourlyInfo(code);
    const hCard = document.createElement("div");
    hCard.className = "hCard";
    hCard.innerHTML = `
      <div class="time">${String(i).padStart(2, "0")}:00</div>
      <img src="https://bmcdn.nl/assets/weather-icons/v3.0/fill/svg/${hInfo.icon}.svg" width="40">
      <div class="temp">${hourlyTemps[i]}°C</div>
    `;
    hourlyF.append(hCard);
  }

  // Weekly forecast
  renderWeeklyForecast(data.daily);

  // Place suggestions 
  await loadPlacesData();
  const cityEl = document.querySelector(".city");
  const cityName = cityEl ? cityEl.innerText : "";

  const tabDefs = [
    {
      key: "outdoor",
      label: "Outdoor",
      badge: "Outdoor",
      badgeClass: "badge-outdoor",
    },
    {
      key: "indoor",
      label: "Indoor",
      badge: "Indoor",
      badgeClass: "badge-indoor",
    },
    {
      key: "night",
      label: "Tonight",
      badge: "Tonight",
      badgeClass: "badge-night",
    },
  ];

  let psActive = isDay
    ? c.weather_code >= 51 || currentTemp < 8
      ? "indoor"
      : "outdoor"
    : "night";

  function renderPsCards() {
    const psCards = document.getElementById("psCards");
    psCards.innerHTML = "";
    const match = placesData?.cities?.find(
      (ci) =>
        cityName.toLowerCase().includes(ci.name.toLowerCase()) ||
        ci.name
          .toLowerCase()
          .includes(cityName.split(",")[0].trim().toLowerCase()),
    );
    const tab = tabDefs.find((t) => t.key === psActive);
    const pool = match
      ? match[psActive]
      : getFallbackPlaces(
          c.weather_code,
          currentTemp,
          psActive === "night" ? false : isDay,
        );

    document.getElementById("psBadge").innerHTML =
      `<div class="ps-badge ${tab.badgeClass}">${tab.badge}</div>`;
    pool.forEach((p, i) => {
      const card = document.createElement("div");
      card.className = `psCard ${psActive}`;
      card.innerHTML = `
    <div class="ps-shimmer"></div>
    <div>
      <div class="psPlace">${p.place}</div>
      <div class="desc">${p.desc}</div>
    </div>
    <div class="ps-number">0${i + 1}</div>
  `;
      psCards.appendChild(card);
    });

    document.querySelectorAll(".ps-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.key === psActive);
    });
  }

  const psTabs = document.getElementById("psTabs");
  psTabs.innerHTML = "";
  tabDefs.forEach((t) => {
    const btn = document.createElement("button");
    btn.className = "ps-tab" + (t.key === psActive ? " active" : "");
    btn.dataset.key = t.key;
    btn.textContent = t.label;
    btn.onclick = () => {
      psActive = t.key;
      renderPsCards();
    };
    psTabs.appendChild(btn);
  });
  renderPsCards();

  setTimeout(() => initWindCanvas(windSpeed, windDir), 50);
}

// Calling current location
async function currentLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      fetchWeather().then(resolve);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude.toFixed(2);
        const lng = position.coords.longitude.toFixed(2);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
          );
          const data = await res.json();
          const address = data.address;
          const city =
            address.city ||
            address.town ||
            address.municipality ||
            address.county;
          const cityEl = document.querySelector(".city");
          if (cityEl) cityEl.innerText = `${city}, ${address.country}`;
          if (city) localStorage.setItem("lastCity", city);
        } catch (err) {
          console.error("Reverse geocoding failed:", err);
        }
        weatherAPI =
          `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${lat}&longitude=${lng}` +
          `&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant` +
          `&hourly=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m,wind_direction_10m` +
          `&current=temperature_2m,is_day,relative_humidity_2m,rain,snowfall,weather_code,wind_speed_10m,wind_direction_10m` +
          `&minutely_15=temperature_2m,relative_humidity_2m,rain,weather_code,wind_speed_10m,wind_direction_10m,is_day`;
        await fetchWeather();
        resolve();
      },
      async (err) => {
        console.warn("Geolocation denied or failed:", err.message);
        await fetchWeather();
        resolve();
      },
      { timeout: 8000 },
    );
  });
}

// Saved locations 
function getSaved() {
  try {
    return JSON.parse(localStorage.getItem("savedLocations")) || [];
  } catch {
    return [];
  }
}

function setSaved(arr) {
  localStorage.setItem("savedLocations", JSON.stringify(arr));
}

function renderSavedCards() {
  const saved = getSaved();
  const el = document.getElementById("savedCards");
  if (!el) return;

  if (!saved.length) {
    el.innerHTML =
      '<div class="savedEmpty">No saved locations yet.<br>Hit Save on any city to add it here.</div>';
    return;
  }

  el.innerHTML = "";
  saved.forEach((s, i) => {
    const card = document.createElement("div");
    card.className = "savedCard";
    card.innerHTML = `
      <div class="savedCardLeft">
        <div class="savedCardCity">${s.city}</div>
        <div class="savedCardMeta">${s.time}</div>
        <div class="savedCardBottom">
          <div class="savedCardTemp">${s.temp}</div>
          <div class="savedCardLabel">${s.label}</div>
        </div>
      </div>
      <div class="savedCardIcon">
        <img src="https://bmcdn.nl/assets/weather-icons/v3.0/fill/svg/${s.icon}.svg">
      </div>
      <div class="savedCardRight">
        <button class="savedCardRemove" data-i="${i}">&#x2715;</button>
      </div>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("savedCardRemove")) return;
      closeSavedOverlay();
      searchCity(s.cityRaw);
    });
    el.appendChild(card);
  });

  el.querySelectorAll(".savedCardRemove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const arr = getSaved();
      arr.splice(+btn.dataset.i, 1);
      setSaved(arr);
      renderSavedCards();
    });
  });
}

function openSavedOverlay() {
  renderSavedCards();
  document.getElementById("savedOverlay").classList.add("show");
}

function closeSavedOverlay() {
  document.getElementById("savedOverlay").classList.remove("show");
}

// Fetching API 
async function fetchWeather() {
  load(true);
  try {
    const response = await fetch(weatherAPI);
    if (!response.ok) throw new Error("Failed to fetch weather data");
    const data = await response.json();
    await renderWeather(data);
  } catch (err) {
    console.error("Error fetching weather:", err);
  }
  load(false);
}

// Day Night Toggle
function dayNight(mode) {
  const body = document.body;
  const dayBtn = document.getElementById("dayBtn");
  const nightBtn = document.getElementById("nightBtn");
  const starsOverlay = document.getElementById("stars-overlay");
  const rainOverlay = document.getElementById("rain-overlay");

  if (mode === "day") {
    isNightMode = false;
    body.classList.remove("night");
    body.classList.add("day");
    dayBtn.classList.add("active");
    nightBtn.classList.remove("active");
    localStorage.setItem("theme", "day");
    if (starsOverlay) starsOverlay.innerHTML = "";
    if (rainOverlay) {
      rainOverlay.classList.add("visible");
      rainOverlay.innerHTML = "";
      buildRain();
    }
  } else {
    isNightMode = true;
    body.classList.remove("day");
    body.classList.add("night");
    nightBtn.classList.add("active");
    dayBtn.classList.remove("active");
    localStorage.setItem("theme", "night");
    if (starsOverlay) {
      starsOverlay.classList.add("visible");
      starsOverlay.innerHTML = "";
      buildStars();
    }
  }

  fetchWeather();
}

// Loading website
window.onload = function () {
  const savedTheme = localStorage.getItem("theme") || "day";
  const body = document.body;
  const dayBtn = document.getElementById("dayBtn");
  const nightBtn = document.getElementById("nightBtn");

  if (savedTheme === "night") {
    isNightMode = true;
    body.classList.remove("day");
    body.classList.add("night");
    nightBtn.classList.add("active");
    dayBtn.classList.remove("active");
  } else {
    isNightMode = false;
    body.classList.remove("night");
    body.classList.add("day");
    dayBtn.classList.add("active");
    nightBtn.classList.remove("active");
  }

  const lastCity = localStorage.getItem("lastCity");
  if (lastCity) {
    searchCity(lastCity);
  } else {
    currentLocation();
  }

  const btn = document.querySelector(".searchBtn button");
  if (btn) btn.addEventListener("click", handleSearch);

  const input = document.getElementById("search");
  if (input)
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSearch();
    });

  document
    .querySelector(".saved button")
    .addEventListener("click", openSavedOverlay);
  document
    .getElementById("savedCloseBtn")
    .addEventListener("click", closeSavedOverlay);
  document.getElementById("savedOverlay").addEventListener("click", (e) => {
    if (e.target === document.getElementById("savedOverlay"))
      closeSavedOverlay();
  });
};

// Star creation
function buildStars() {
  const el = document.getElementById("stars-overlay");
  for (let i = 0; i < 120; i++) {
    const s = document.createElement("div");
    const size = Math.random() * 2.5 + 0.5;
    s.className = "star";
    s.style.cssText = `
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      width:${size}px; height:${size}px;
      --max-op:${Math.random() * 0.7 + 0.3};
      --dur:${Math.random() * 3 + 1.5}s;
      animation-delay:${Math.random() * 3}s;
    `;
    el.appendChild(s);
  }
}

// Rain creation
function buildRain() {
  const el = document.getElementById("rain-overlay");
  for (let i = 0; i < 80; i++) {
    const r = document.createElement("div");
    const h = Math.random() * 60 + 30;
    r.className = "raindrop";
    r.style.cssText = `
      left:${Math.random() * 100}%;
      height:${h}px;
      opacity:${Math.random() * 0.5 + 0.2};
      animation-duration:${Math.random() * 0.8 + 0.6}s;
      animation-delay:${Math.random() * 2}s;
    `;
    el.appendChild(r);
  }
}

// Wind canvas
function initWindCanvas(speed, direction) {
  const windCanvas = document.getElementById("wind-canvas");
  if (!windCanvas) return;
  windCtx = windCanvas.getContext("2d");

  const dpr = window.devicePixelRatio || 1;
  const rect = windCanvas.getBoundingClientRect();
  windCanvas.width = rect.width * dpr;
  windCanvas.height = rect.height * dpr;
  windCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = rect.width;
  const H = 160;
  windParticles = [];

  const count = Math.max(20, Math.min(60, speed * 2));
  const radians = ((direction - 90) * Math.PI) / 180;
  const vx = Math.cos(radians) * (0.5 + speed / 60);
  const vy = Math.sin(radians) * (0.5 + speed / 60);

  for (let i = 0; i < count; i++) {
    windParticles.push({
      x: Math.random() * W,
      y: Math.random() * H,
      len: Math.random() * 30 + 10,
      speed: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.5 + 0.1,
      vx,
      vy,
    });
  }

  cancelAnimationFrame(animFrame);
  animateWind(W, H, vx, vy);
}

// Wind animation
function animateWind(W, H, vx, vy) {
  windCtx.clearRect(0, 0, W, H);
  windCtx.fillStyle = "rgba(0,0,0,0.03)";
  windCtx.fillRect(0, 0, W, H);

  windParticles.forEach((p) => {
    const tail = { x: p.x - vx * p.len, y: p.y - vy * p.len };
    const grad = windCtx.createLinearGradient(tail.x, tail.y, p.x, p.y);
    grad.addColorStop(0, `rgba(255,255,255,0)`);
    grad.addColorStop(1, `rgba(255,255,255,${p.opacity})`);
    windCtx.beginPath();
    windCtx.moveTo(tail.x, tail.y);
    windCtx.lineTo(p.x, p.y);
    windCtx.strokeStyle = grad;
    windCtx.lineWidth = 1.5;
    windCtx.stroke();
    p.x += vx * p.speed;
    p.y += vy * p.speed;
    if (p.x > W + 20) p.x = -20;
    if (p.x < -20) p.x = W + 20;
    if (p.y > H + 20) p.y = -20;
    if (p.y < -20) p.y = H + 20;
  });

  animFrame = requestAnimationFrame(() => animateWind(W, H, vx, vy));
}

// Weekly Forecast 
function buildAllWeeks(centerYear, centerMonth) {
  function daysInMonth(y, m) {
    return new Date(y, m + 1, 0).getDate();
  }

  function getMonthWeeks(y, m) {
    const firstDow = new Date(y, m, 1).getDay();
    const total = daysInMonth(y, m);
    const prevM = m === 0 ? 11 : m - 1,
      prevY = m === 0 ? y - 1 : y;
    const nextM = m === 11 ? 0 : m + 1,
      nextY = m === 11 ? y + 1 : y;
    const prevTotal = daysInMonth(prevY, prevM);
    const cells = [];
    for (let i = firstDow - 1; i >= 0; i--)
      cells.push({
        day: prevTotal - i,
        month: prevM,
        year: prevY,
        overflow: true,
      });
    for (let d = 1; d <= total; d++)
      cells.push({ day: d, month: m, year: y, overflow: false });
    const rem = cells.length % 7;
    if (rem !== 0)
      for (let d = 1; d <= 7 - rem; d++)
        cells.push({ day: d, month: nextM, year: nextY, overflow: true });
    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }

  function weekLabelMonth(week) {
    const counts = {};
    week.forEach((c) => {
      const k = `${c.year}-${c.month}`;
      counts[k] = (counts[k] || 0) + 1;
    });
    let best = null,
      bestCount = 0;
    for (const k in counts) {
      if (counts[k] > bestCount) {
        bestCount = counts[k];
        best = k;
      }
    }
    const [y, m] = best.split("-").map(Number);
    return { year: y, month: m };
  }

  const months = [];
  for (let delta = -1; delta <= 1; delta++) {
    let m = centerMonth + delta,
      y = centerYear;
    if (m < 0) {
      m += 12;
      y--;
    }
    if (m > 11) {
      m -= 12;
      y++;
    }
    months.push({ y, m });
  }

  const seen = new Set(),
    allWeeks = [];
  months.forEach(({ y, m }) => {
    getMonthWeeks(y, m).forEach((week) => {
      const key = week.map((c) => `${c.year}-${c.month}-${c.day}`).join("|");
      if (seen.has(key)) return;
      const label = weekLabelMonth(week);
      if (label.year === y && label.month === m) {
        seen.add(key);
        allWeeks.push({ cells: week, labelYear: y, labelMonth: m });
      }
    });
  });
  return allWeeks;
}

function renderWeeklyForecast(daily) {
  const PAGE_SIZE = 5;
  let globalWeeks = [];
  let globalIndex = 0;
  let windowStart = 0;

  function rebuild(y, m) {
    globalWeeks = buildAllWeeks(y, m);
  }

  function maybeRebuild() {
    const week = globalWeeks[globalIndex];
    if (!week) return;
    if (globalIndex === 0 || globalIndex === globalWeeks.length - 1) {
      const savedKey = week.cells
        .map((c) => `${c.year}-${c.month}-${c.day}`)
        .join("|");
      rebuild(week.labelYear, week.labelMonth);
      globalIndex = globalWeeks.findIndex(
        (w) =>
          w.cells.map((c) => `${c.year}-${c.month}-${c.day}`).join("|") ===
          savedKey,
      );
      if (globalIndex < 0) globalIndex = 0;
    }
  }

  function clampWindow() {
    if (globalIndex < windowStart) windowStart = globalIndex;
    else if (globalIndex >= windowStart + PAGE_SIZE)
      windowStart = globalIndex - PAGE_SIZE + 1;
    windowStart = Math.max(
      0,
      Math.min(windowStart, Math.max(0, globalWeeks.length - PAGE_SIZE)),
    );
  }

  function draw() {
    const week = globalWeeks[globalIndex];
    if (!week) return;
    const today = new Date();

    document.getElementById("wfMonthLabel").textContent =
      new Date(week.labelYear, week.labelMonth).toLocaleString("en", {
        month: "long",
      }) +
      " " +
      week.labelYear;

    const grid = document.getElementById("wfGrid");
    grid.innerHTML = "";
    const row = document.createElement("div");
    row.className = "wfWeekRow";

    week.cells.forEach(({ day, month, year, overflow }) => {
      const cell = document.createElement("div");
      const isToday =
        year === today.getFullYear() &&
        month === today.getMonth() &&
        day === today.getDate();
      cell.className =
        "wfDay" + (isToday ? " today" : "") + (overflow ? " overflow" : "");

      const di = Math.min(day - 1, (daily?.weather_code?.length || 1) - 1);
      const code = daily?.weather_code?.[di] ?? 0;
      const max = daily?.temperature_2m_max?.[di]?.toFixed(0) ?? "--";
      const min = daily?.temperature_2m_min?.[di]?.toFixed(0) ?? "--";

      cell.innerHTML = `
        <div class="wfDayNum">${day}</div>
        <img src="https://bmcdn.nl/assets/weather-icons/v3.0/fill/svg/${hourlyInfo(code).icon}.svg">
        <div class="wfTemp">${max}° - ${min}°</div>
      `;
      row.appendChild(cell);
    });
    grid.appendChild(row);

    // Pagination
    clampWindow();
    const pag = document.getElementById("wfPagination");
    pag.innerHTML = "";

    const prevBtn = document.createElement("button");
    prevBtn.className = "wfPageBtn arrow";
    prevBtn.innerHTML = "&#8249;";
    prevBtn.disabled = globalIndex === 0;
    prevBtn.onclick = () => {
      globalIndex--;
      maybeRebuild();
      clampWindow();
      draw();
    };
    pag.appendChild(prevBtn);

    for (let slot = 0; slot < PAGE_SIZE; slot++) {
      const wi = windowStart + slot;
      const btn = document.createElement("button");
      btn.className = "wfPageBtn";
      if (wi >= globalWeeks.length) {
        btn.classList.add("hidden");
        btn.textContent = "–";
      } else {
        const w = globalWeeks[wi];
        const valid = w.cells.filter((c) => !c.overflow);
        btn.textContent = `${valid[0].day}–${valid[valid.length - 1].day}`;
        if (wi === globalIndex) btn.classList.add("active");
        btn.onclick = () => {
          globalIndex = wi;
          draw();
        };
      }
      pag.appendChild(btn);
    }

    const nextBtn = document.createElement("button");
    nextBtn.className = "wfPageBtn arrow";
    nextBtn.innerHTML = "&#8250;";
    nextBtn.disabled = globalIndex === globalWeeks.length - 1;
    nextBtn.onclick = () => {
      globalIndex++;
      maybeRebuild();
      clampWindow();
      draw();
    };
    pag.appendChild(nextBtn);
  }

  document.getElementById("prevMonth").onclick = () => {
    let m = globalWeeks[globalIndex].labelMonth - 1;
    let y = globalWeeks[globalIndex].labelYear;
    if (m < 0) {
      m = 11;
      y--;
    }
    rebuild(y, m);
    globalIndex = globalWeeks.findIndex(
      (w) => w.labelYear === y && w.labelMonth === m,
    );
    if (globalIndex < 0) globalIndex = 0;
    windowStart = globalIndex;
    draw();
  };

  document.getElementById("nextMonth").onclick = () => {
    let m = globalWeeks[globalIndex].labelMonth + 1;
    let y = globalWeeks[globalIndex].labelYear;
    if (m > 11) {
      m = 0;
      y++;
    }
    rebuild(y, m);
    globalIndex = globalWeeks.findIndex(
      (w) => w.labelYear === y && w.labelMonth === m,
    );
    if (globalIndex < 0) globalIndex = 0;
    windowStart = globalIndex;
    draw();
  };

  // Init — start on today's week
  const today = new Date();
  rebuild(today.getFullYear(), today.getMonth());
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  globalIndex = globalWeeks.findIndex((w) =>
    w.cells.some(
      (c) => !c.overflow && `${c.year}-${c.month}-${c.day}` === todayStr,
    ),
  );
  if (globalIndex < 0) globalIndex = 0;
  windowStart = globalIndex;
  draw();
}
