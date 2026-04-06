async function searchCity(cityName) {
  try {
    const res = await fetch(
      `${geoCodingAPI}?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`
    );
    if (!res.ok) throw new Error("Geocoding failed");

    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      alert(`City "${cityName}" not found.`);
      return;
    }

    const { latitude, longitude, name, country } = data.results[0];

    // Update city label in your .city span
    const cityEl = document.querySelector(".city");
    if (cityEl) cityEl.innerText = `${name}, ${country}`;

    currentWeatherURL =
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

function handleSearch() {
  const input = document.getElementById("search");
  const city = input.value.trim();
  if (city) searchCity(city);
}