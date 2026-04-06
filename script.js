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

// Humidity description based on huminity percent
function getHumidityDesc(h) {
  if (h < 40) return "Dry air — comfortable";
  if (h < 50) return "Ideal — comfortable and healthy";
  if (h < 70) return "Moderate humidity";
  return "High humidity — feels sticky";
}

// Icon setting based on hourly weather code
function hourlyInfo(code) {
  if (code === 0) {
    return { icon: "clear-day" };
  }

  if (code <= 2) {
    return { icon: "partly-cloudy-night" };
  }

  if (code === 3) return { icon: "overcast-day" };
  if (code <= 49) return { icon: "fog" };
  if (code <= 59) return { icon: "drizzle" };
  if (code <= 69) return { icon: "rain" };
  if (code <= 79) return { icon: "snow" };
  if (code <= 94) return { icon: "thunderstorms" };

  return { icon: "cloudy" };
}

// Converting the cityname into latitude and longitude, and replace in the weather URL
async function searchCity(cityName) {
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

    // Update city label in your .city span
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
}

// handlding Searches
function handleSearch() {
  const input = document.getElementById("search");
  const city = input.value.trim();
  if (city) searchCity(city);
}

// Renderng weather
function renderWeather(data) {
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

  // Current Temperature
  const currentEl = document.getElementById("currentTemp");
  if (currentEl) currentEl.innerText = `${currentTemp}°C`;

  const weather = document.querySelector(".weather");
  if (weather) {
    weather.innerHTML = `
      <div class="estWeather">${wInfo.label}</div>
      <div class="estTemp">
        ${currentTemp}°C 
        <img class="weatherIcon" 
       src="https://bmcdn.nl/assets/weather-icons/v3.0/fill/svg/${wInfo.icon}.svg">
      </div>
    `;
  }

  // Humidity
  const estHumidity = document.querySelector(".estHumidity");
  estHumidity.innerHTML = `<div class="value">${humidity}% </div>
  <div class="humidity-bar">
    <div class="humidity-fill"></div>
  </div>

  <div class="desc">${getHumidityDesc(humidity)}</div>`;
  const humidityFill = document.querySelector(".humidity-fill");
  if (humidityFill) {
    humidityFill.style.width = `${humidity}%`;
  }

  // Average Temperature
  const sum = hourlyTemps.reduce((total, temp) => total + temp, 0);
  const avgTemp = sum / hourlyTemps.length;
  const atd = currentTemp - avgTemp;
  const averageTemp = document.querySelector(".avgTemp");
  averageTemp.innerHTML = `${avgTemp.toFixed(1)}°C
  <div class="avgTDescription"><span>${atd.toFixed(1)}°C</span> higher than Average Temperature </div>`;

  //Wind Canvas
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

  setTimeout(() => initWindCanvas(windSpeed, windDir), 50);
}

// Fetching API
async function fetchWeather() {
  try {
    const response = await fetch(weatherAPI);
    if (!response.ok) throw new Error("Failed to fetch weather data");
    const data = await response.json();
    renderWeather(data);
  } catch (err) {
    console.error("Error fetching weather:", err);
  }
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
  }

  // Reload the website when search button is clicked
  const btn = document.querySelector(".searchBtn button");
  if (btn) btn.addEventListener("click", handleSearch);

  // Reload the website when someone enter the "Enter" after the city is written
  const input = document.getElementById("search");
  if (input)
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSearch();
    });
};

// Star creation (AI generated)
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

// Rain creation (AI generated)
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

// Wind canvas (AI generated)
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

// Wind animation (AI generated)
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
