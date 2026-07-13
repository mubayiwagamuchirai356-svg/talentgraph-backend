const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());

// Enforce comprehensive CORS allowance so Vercel never gets blocked
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// In-memory key-value store using GitHub username as unique key to prevent duplicates
let talentPool = {};

/**
 * POST /api/talent/register
 * Enforces uniqueness and aggregates telemetry from GitHub API
 */
app.post('/api/talent/register', async (req, res) => {
  try {
    const { name, email, city, country, lat, lng, githubUsername, skills } = req.body;
    const cleanUsername = githubUsername.trim().toLowerCase();

    // 1. Fetch live telemetry metrics from public GitHub API
    let publicRepos = 0;
    let topLanguages = [];

    try {
      const githubRes = await axios.get(`https://api.github.com/users/${cleanUsername}`, {
        headers: { 'User-Agent': 'Kwancho-Talent-App' }
      });
      publicRepos = githubRes.data.public_repos || 0;
      
      // Fetch user repos to isolate top core technologies
      const reposRes = await axios.get(`https://api.github.com/users/${cleanUsername}/repos?per_page=5&sort=updated`, {
        headers: { 'User-Agent': 'Kwancho-Talent-App' }
      });
      
      if (Array.isArray(reposRes.data)) {
        const langs = reposRes.data
          .map(repo => repo.language)
          .filter(lang => lang !== null);
        topLanguages = [...new Set(langs)];
      }
    } catch (gitErr) {
      console.warn(`GitHub metrics fetch skipped/failed for user ${cleanUsername}:`, gitErr.message);
      // Fallback defaults if user doesn't exist or API hits rate limits
      publicRepos = 0;
      topLanguages = ["Vanilla Stack"];
    }

    // 2. Aggregate form data with computed GitHub telemetry metrics
    const newPassport = {
      _id: cleanUsername, // In-memory unique key representation
      name,
      email,
      location: { city, country, lat: parseFloat(lat), lng: parseFloat(lng) },
      githubUsername: cleanUsername,
      skills: Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim()),
      metrics: {
        publicRepos,
        topLanguages: topLanguages.length > 0 ? topLanguages : ["Vanilla Stack"]
      }
    };

    // 3. Save directly into memory store 
    talentPool[cleanUsername] = newPassport;

    // 4. Return success back to front-end
    return res.status(201).json({ success: true, message: "Profile minted successfully!", data: newPassport });

  } catch (err) {
    console.error("Critical error in registration system:", err);
    return res.status(500).json({ error: "Internal Server Processing Failure" });
  }
});

/**
 * GET /api/talent/
 * Delivers array mapping to frontend's live telemetry dynamic state engine
 */
app.get('/api/talent', (req, res) => {
  return res.json(Object.values(talentPool));
});

// System Status landing root check for Render health routing
app.get('/', (req, res) => {
  res.json({ status: "online", system: "Kwancho Core API Active" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`[SYSTEM] Gateway deployed running on port ${PORT}`));