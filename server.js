require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ===============================
// API CONFIGURATION
// ===============================

const NASA_API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const SOLAR_API_TOKEN = process.env.SOLAR_API_TOKEN || '';

const SOLAR_BASE = 'https://api.le-systeme-solaire.net/rest';
const NASA_APOD_URL = 'https://science.nasa.gov/wp-json/wp/v2/apod-basic/';
const ISS_URL = 'http://api.open-notify.org/iss-now.json';
const ASTROS_URL = 'http://api.open-notify.org/astros.json';

// ===============================
// PLANETS
// ===============================

const PLANETS = {
  mercury: 'mercury',
  venus: 'venus',
  earth: 'earth',
  mars: 'mars',
  jupiter: 'jupiter',
  saturn: 'saturn',
  uranus: 'uranus',
  neptune: 'neptune',
  sun: 'sun',
  moon: 'moon'
};

const PLANET_ALIASES = {
  mercury: ['mercury'],
  venus: ['venus'],
  earth: ['earth', 'our planet', 'home planet'],
  mars: ['mars', 'red planet'],
  jupiter: ['jupiter'],
  saturn: ['saturn'],
  uranus: ['uranus'],
  neptune: ['neptune'],
  sun: ['sun', 'solar'],
  moon: ['moon', 'luna'],
  pluto: ['pluto'],
};

// ===============================
// TEXT HELPERS
// ===============================

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function findPlanet(text) {
  const lower = text.toLowerCase();

  for (const [planet, aliases] of Object.entries(PLANET_ALIASES)) {
    if (aliases.some(alias => lower.includes(alias))) {
      return planet;
    }
  }

  return null;
}

// ===============================
// INTENT CLASSIFICATION
// ===============================

function classifyIntent(message) {
  const text = cleanText(message).toLowerCase();

  if (!text) {
    return { intent: 'empty' };
  }

  if (/^(hi|hello|hey|hai|good morning|good evening)\b/.test(text)) {
    return { intent: 'greeting' };
  }

  if (/\b(help|what can you do|features|commands)\b/.test(text)) {
    return { intent: 'help' };
  }

  if (
    /\b(apod|astronomy picture|picture of the day|space picture|nasa picture)\b/.test(
      text
    )
  ) {
    return { intent: 'apod' };
  }

  if (
    /\b(iss|international space station|space station)\b/.test(text)
  ) {
    return { intent: 'iss' };
  }

  if (
    /\b(people|humans|astronauts)\b/.test(text) &&
    /\b(space|orbit|station)\b/.test(text)
  ) {
    return { intent: 'people' };
  }

  if (
    /\b(how many|who is|who are|people in space|humans in space)\b/.test(text)
  ) {
    return { intent: 'people' };
  }

  const planet = findPlanet(text);

if (planet) {
  const generalQuestion =
    /\b(why|how|explain|describe|what causes|what makes|tell me why|why is|why are)\b/.test(text);

  if (generalQuestion) {
    return { intent: 'general' };
  }

  return { intent: 'planet', planet };
}

  if (
    /\b(search|find|look up)\b/.test(text) &&
    /\b(space|planet|astronomy|astronomical)\b/.test(text)
  ) {
    return { intent: 'help' };
  }

  return { intent: 'general' };
}

// ===============================
// HTTP HELPER
// ===============================

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(15000)
  });

  const bodyText = await response.text();

  let data;

  try {
    data = JSON.parse(bodyText);
  } catch {
    data = { raw: bodyText };
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
      data?.error ||
      `API request failed (${response.status})`
    );

    error.status = response.status;
    throw error;
  }

  return data;
}

// ===============================
// HTML CLEANER
// ===============================

function cleanHtml(html) {
  if (!html) return '';

  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

// ===============================
// NASA APOD
// ===============================

async function getApod(date) {
  const url = new URL(NASA_APOD_URL);

  url.searchParams.set('api_key', NASA_API_KEY);

  if (date) {
    url.searchParams.set('date', date);
  }

  const data = await fetchJson(url.toString());

  return Array.isArray(data) ? data[0] : data;
}

// ===============================
// SOLAR SYSTEM API
// ===============================

async function getSolarBody(id) {
  if (
    !SOLAR_API_TOKEN ||
    SOLAR_API_TOKEN.includes('PASTE_YOUR')
  ) {
    const error = new Error(
      'Solar System OpenData token is missing. Add SOLAR_API_TOKEN to your .env file.'
    );

    error.code = 'SOLAR_TOKEN_MISSING';

    throw error;
  }

  return fetchJson(
    `${SOLAR_BASE}/bodies/${encodeURIComponent(id)}`,
    {
      headers: {
        Authorization: `Bearer ${SOLAR_API_TOKEN}`
      }
    }
  );
}

// ===============================
// OPEN NOTIFY
// ===============================

async function getIss() {
  return fetchJson(ISS_URL);
}

async function getPeopleInSpace() {
  return fetchJson(ASTROS_URL);
}

// ===============================
// FORMAT HELPERS
// ===============================

function formatNumber(value, digits = 2) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 'Not available';
  }

  const num = Number(value);

  if (!Number.isFinite(num)) {
    return String(value);
  }

  return num.toLocaleString('en-IN', {
    maximumFractionDigits: digits
  });
}

// ===============================
// PLANET RESPONSE
// ===============================

function formatPlanet(body) {
  const name = body.englishName || body.name || body.id;

  const lines = [
    `🪐 **${name}**`,
    body.bodyType ? `Type: ${body.bodyType}` : null,
    body.isPlanet ? 'Category: Planet' : null,
    body.meanRadius
      ? `Mean radius: ${formatNumber(body.meanRadius)} km`
      : null,
    body.gravity !== undefined
      ? `Surface gravity: ${formatNumber(body.gravity)} m/s²`
      : null,
    body.density !== undefined
      ? `Density: ${formatNumber(body.density)} g/cm³`
      : null,
    body.avgTemp !== undefined
      ? `Average temperature: ${formatNumber(body.avgTemp)} K`
      : null,
    body.sideralRotation !== undefined
      ? `Rotation period: ${formatNumber(body.sideralRotation)} hours`
      : null,
    body.sideralOrbit !== undefined
      ? `Orbital period: ${formatNumber(body.sideralOrbit)} Earth days`
      : null,
    body.moons?.length
      ? `Known moons listed: ${body.moons.length}`
      : null
  ].filter(Boolean);

  return lines.join('\n');
}

// ===============================
// NASA RESPONSE
// ===============================

function apodResponse(apod) {
  if (!apod || !apod.title) {
    throw new Error('NASA returned an empty APOD response.');
  }

  const mediaType = String(
    apod.media_type || 'image'
  ).toLowerCase();

  const mediaUrl =
    apod.hdurl ||
    (mediaType === 'image'
      ? apod.url
      : apod.permalink);

  const media = mediaUrl
    ? (
        mediaType === 'image'
          ? {
              type: 'image',
              url: mediaUrl,
              title: apod.title
            }
          : {
              type: 'video',
              url: mediaUrl,
              title: apod.title
            }
      )
    : undefined;

  return {
    text:
      `🌌 **NASA Astronomy Picture of the Day**\n\n` +
      `**Title:** ${apod.title}\n` +
      `**Date:** ${apod.date || 'Unknown'}\n\n` +
      `${cleanHtml(apod.explanation) || 'NASA did not provide an explanation.'}`,

    media,

    source: 'NASA APOD',

    data: {
      title: apod.title,
      date: apod.date,
      mediaType,
      imageUrl: apod.hdurl || null,
      pageUrl: apod.permalink || apod.url || null,
      credit: apod.credit || apod.copyright || null
    }
  };
}

// ===============================
// HELP RESPONSE
// ===============================

function helpResponse() {
  return {
    text:
      `🚀 **CosmoGuide AI can understand natural-language space questions.**\n\n` +
      `Try:\n` +
      `• "What is Mars?"\n` +
      `• "Tell me Jupiter's gravity"\n` +
      `• "Why is Saturn famous?"\n` +
      `• "Where is the ISS right now?"\n` +
      `• "How many people are in space?"\n` +
      `• "Show me NASA's Astronomy Picture of the Day"\n` +
      `• "Tell me about the Moon"\n\n` +
      `Buttons are optional shortcuts; you can type your question directly.`
  };
}

// ===============================
// FREE GENERAL RESPONSES
// ===============================

function generalResponse(message) {
  const text = message.toLowerCase();

  if (
    text.includes('why is mars red') ||
    text.includes('why mars is red') ||
    text.includes('why is mars called the red planet') ||
    text.includes('why mars called the red planet')
  ) {
    return {
      text:
        `🔴 **Why is Mars called the Red Planet?**\n\n` +
        `Mars is called the Red Planet because its surface contains iron minerals. ` +
        `These minerals react with oxygen and form iron oxide, commonly known as rust. ` +
        `The rusty dust gives Mars its reddish appearance.`
    };
  }

  if (
    text.includes('what is a black hole') ||
    text.includes('black hole')
  ) {
    return {
      text:
        `🕳️ **What is a Black Hole?**\n\n` +
        `A black hole is a region of space where gravity is extremely strong. ` +
        `Nothing, including light, can escape once it passes the event horizon.`
    };
  }

  if (
    text.includes('what is a galaxy') ||
    text.includes('galaxy')
  ) {
    return {
      text:
        `🌌 **What is a Galaxy?**\n\n` +
        `A galaxy is a huge collection of stars, gas, dust and other matter ` +
        `held together by gravity. The Milky Way is the galaxy that contains our Solar System.`
    };
  }

  if (
    text.includes('what is gravity') ||
    text.includes('gravity')
  ) {
    return {
      text:
        `🌍 **What is Gravity?**\n\n` +
        `Gravity is the force of attraction between objects with mass. ` +
        `It keeps planets in orbit around stars and keeps objects on the surface of planets.`
    };
  }

  if (
    text.includes('what is the sun') ||
    text.includes('tell me about the sun')
  ) {
    return {
      text:
        `☀️ **The Sun**\n\n` +
        `The Sun is a star at the center of our Solar System. ` +
        `It provides the light and heat that make life on Earth possible.`
    };
  }

  if (
    text.includes('what is the moon') ||
    text.includes('tell me about the moon')
  ) {
    return {
      text:
        `🌕 **The Moon**\n\n` +
        `The Moon is Earth's natural satellite. ` +
        `Its gravity influences Earth's ocean tides, and it takes about 27.3 days to orbit Earth relative to the stars.`
    };
  }

  return {
    text:
      `🚀 **CosmoGuide AI**\n\n` +
      `I can answer common space and astronomy questions and provide live data from NASA, ` +
      `Open Notify and the Solar System OpenData API.\n\n` +
      `Try asking:\n` +
      `• Why is Mars red?\n` +
      `• What is a black hole?\n` +
      `• Tell me about Jupiter\n` +
      `• Where is the ISS?\n` +
      `• How many people are in space?\n` +
      `• Show me today's NASA picture.`
  };
}

// ===============================
// HEALTH CHECK
// ===============================

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'CosmoGuide AI',
    nasaConfigured: Boolean(NASA_API_KEY),
    solarTokenConfigured: Boolean(
      SOLAR_API_TOKEN &&
      !SOLAR_API_TOKEN.includes('PASTE_YOUR')
    ),
    openNotify: true,
    time: new Date().toISOString()
  });
});

// ===============================
// APOD API
// ===============================

app.get('/api/apod', async (req, res) => {
  try {
    const apod = await getApod(req.query.date);

    res.json(apodResponse(apod));
  } catch (error) {
    res.status(502).json({
      error: `NASA APOD request failed: ${error.message}`
    });
  }
});

// ===============================
// PLANET API
// ===============================

app.get('/api/planet/:name', async (req, res) => {
  const name = String(req.params.name).toLowerCase();

  if (!PLANETS[name]) {
    return res.status(400).json({
      error: 'Unknown celestial body.'
    });
  }

  try {
    const body = await getSolarBody(PLANETS[name]);

    res.json({
      body,
      text: formatPlanet(body),
      source: 'The Solar System OpenData'
    });
  } catch (error) {
    const status =
      error.code === 'SOLAR_TOKEN_MISSING'
        ? 503
        : 502;

    res.status(status).json({
      error: error.message
    });
  }
});

// ===============================
// ISS API
// ===============================

app.get('/api/iss', async (req, res) => {
  try {
    const data = await getIss();

    res.json({
      latitude: Number(data.iss_position?.latitude),
      longitude: Number(data.iss_position?.longitude),
      timestamp: data.timestamp,
      source: 'Open Notify'
    });
  } catch (error) {
    res.status(502).json({
      error:
        `Open Notify ISS request failed: ${error.message}`
    });
  }
});

// ===============================
// PEOPLE IN SPACE API
// ===============================

app.get('/api/people-in-space', async (req, res) => {
  try {
    const data = await getPeopleInSpace();

    res.json({
      number: data.number,
      people: data.people || [],
      source: 'Open Notify'
    });
  } catch (error) {
    res.status(502).json({
      error:
        `Open Notify request failed: ${error.message}`
    });
  }
});

// ===============================
// TEST ALL APIS
// ===============================

app.get('/api/test-apis', async (req, res) => {
  const results = {};

  try {
    const apod = await getApod();

    results.nasa = {
      ok: true,
      title: apod?.title || null,
      date: apod?.date || null
    };
  } catch (error) {
    results.nasa = {
      ok: false,
      error: error.message
    };
  }

  try {
    const iss = await getIss();

    results.openNotifyIss = {
      ok: true,
      latitude: iss?.iss_position?.latitude,
      longitude: iss?.iss_position?.longitude
    };
  } catch (error) {
    results.openNotifyIss = {
      ok: false,
      error: error.message
    };
  }

  try {
    const people = await getPeopleInSpace();

    results.openNotifyPeople = {
      ok: true,
      number: people?.number,
      count: people?.people?.length || 0
    };
  } catch (error) {
    results.openNotifyPeople = {
      ok: false,
      error: error.message
    };
  }

  if (
    !SOLAR_API_TOKEN ||
    SOLAR_API_TOKEN.includes('PASTE_YOUR')
  ) {
    results.solarSystem = {
      ok: false,
      error: 'Missing SOLAR_API_TOKEN'
    };
  } else {
    try {
      const mars = await getSolarBody('mars');

      results.solarSystem = {
        ok: true,
        body:
          mars?.englishName ||
          mars?.id ||
          'Mars'
      };
    } catch (error) {
      results.solarSystem = {
        ok: false,
        error: error.message
      };
    }
  }

  const ok = Object.values(results).every(
    item => item.ok
  );

  res
    .status(ok ? 200 : 207)
    .json({
      ok,
      results,
      checkedAt: new Date().toISOString()
    });
});

// ===============================
// CHAT API
// ===============================

app.post('/api/chat', async (req, res) => {
  try {
    const message = cleanText(req.body?.message);
    const classified = classifyIntent(message);

    if (classified.intent === 'empty') {
      return res.status(400).json({
        error: 'Please type a question.'
      });
    }

    if (classified.intent === 'greeting') {
      return res.json({
        text:
          'Hello! 🚀 I’m CosmoGuide AI. Ask me anything about space and astronomy.',
        intent: 'greeting'
      });
    }

    if (classified.intent === 'help') {
      return res.json({
        ...helpResponse(),
        intent: 'help'
      });
    }

    // NASA APOD
    if (classified.intent === 'apod') {
      const apod = await getApod();

      return res.json({
        ...apodResponse(apod),
        intent: 'apod'
      });
    }

    // ISS
    if (classified.intent === 'iss') {
      const data = await getIss();

      return res.json({
        text:
          `🛰️ **International Space Station — Current Position**\n\n` +
          `Latitude: ${formatNumber(
            data.iss_position?.latitude,
            4
          )}°\n` +
          `Longitude: ${formatNumber(
            data.iss_position?.longitude,
            4
          )}°\n\n` +
          `The position is provided by Open Notify.`,

        intent: 'iss',

        data: {
          latitude: Number(
            data.iss_position?.latitude
          ),
          longitude: Number(
            data.iss_position?.longitude
          ),
          timestamp: data.timestamp
        },

        source: 'Open Notify',
media: {
  type: 'image',
  url:" https://thumb.wikimedia.org/wikipedia/commons/thumb/5/59/The_station_pictured_from_the_SpaceX_Crew_Dragon_5.jpg/960px-The_station_pictured_from_the_SpaceX_Crew_Dragon_5.jpg?utm_source=en.wikipedia.org&utm_campaign=parser&utm_content=thumbna"
}


      });
    }

    // People in space
    if (classified.intent === 'people') {
      const data = await getPeopleInSpace();

      const people = (data.people || [])
        .map(
          person =>
            `• ${person.name}${
              person.craft
                ? ` — ${person.craft}`
                : ''
            }`
        )
        .join('\n');

      return res.json({
        text:
          `👨‍🚀 **People in Space Right Now**\n\n` +
          `Number: ${data.number}\n\n` +
          `${people || 'Names are not currently available.'}`,

        intent: 'people',

        data,

        source: 'Open Notify'
      });
    }

    // Planet information
    if (classified.intent === 'planet') {
  const body = await getSolarBody(classified.planet);

  const planetImages = {
    mercury: 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Mercury_in_true_color.jpg',
    venus: 'https://upload.wikimedia.org/wikipedia/commons/e/e5/Venus-real_color.jpg',
    earth: 'https://upload.wikimedia.org/wikipedia/commons/9/97/The_Earth_seen_from_Apollo_17.jpg',
    mars: 'https://upload.wikimedia.org/wikipedia/commons/0/02/OSIRIS_Mars_true_color.jpg',
    jupiter: 'https://upload.wikimedia.org/wikipedia/commons/e/e2/Jupiter.jpg',
    saturn: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Saturn_during_Equinox.jpg',
    uranus: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Uranus2.jpg',
    neptune: 'https://upload.wikimedia.org/wikipedia/commons/5/56/Neptune_Full.jpg',
    pluto: 'https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ca/Pluto_in_True_Color_-_High-Res.png/960px-Pluto_in_True_Color_-_High-Res.png?utm_source=en.wikipedia.org&utm_campaign=imageinfo&utm_content=thumbnail',
    sun: 'https://upload.wikimedia.org/wikipedia/commons/c/c3/Solar_sys8.jpg',
    moon: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/FullMoon2010.jpg'
  };

  return res.json({
    text: formatPlanet(body),
    intent: 'planet',
    planet: classified.planet,
    data: body,
    source: 'The Solar System OpenData',
    media: {
      type: 'image',
      url: planetImages[classified.planet],
      title: body.englishName || classified.planet
    }
  });
}

    // Free general response
    if (classified.intent === 'general') {
      return res.json({
        ...generalResponse(message),
        intent: 'general',
        source: 'CosmoGuide AI'
      });
    }

  } catch (error) {
    if (error.code === 'SOLAR_TOKEN_MISSING') {
      return res.status(503).json({
        error:
          'Solar System OpenData needs a free token. Open .env and set SOLAR_API_TOKEN, then restart the server.'
      });
    }

    console.error(error);

    return res.status(502).json({
      error:
        `The requested space data could not be loaded right now. ${error.message}`
    });
  }
});

// ===============================
// FRONTEND
// ===============================

app.get('*', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'public', 'index.html')
  );
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(
    `\n🚀 CosmoGuide AI running at http://localhost:${PORT}`
  );

  console.log(
    `NASA API key: ${
      NASA_API_KEY ? 'Loaded' : 'Missing'
    }`
  );

  console.log(
    `Solar System token: ${
      SOLAR_API_TOKEN &&
      !SOLAR_API_TOKEN.includes('PASTE_YOUR')
        ? 'Loaded'
        : 'Missing'
    }`
  );
});