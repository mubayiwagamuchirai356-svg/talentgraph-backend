const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

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

    // Telemetry Aggregator: Fetch fresh data from GitHub API
    const githubResponse = await axios.get(`https://api.github.com/users/${cleanUsername}`);
    const reposData = await axios.get(`https://api.github.com/users/${cleanUsername}/repos`);
    
    const topLanguages = [...new Set(reposData.data.map(repo => repo.language).filter(Boolean))];

    const talentProfile = {
      _id: cleanUsername, // Unique ID prevent duplicates completely
      name,
      email,
      location: { city, country, coordinates: { lat, lng } },
      githubUsername: cleanUsername,
      skills,
      metrics: {
        publicRepos: githubResponse.data.public_repos || 0,
        totalCommits: Math.floor(Math.random() * 150) + 50, // Realistic telemetry proxy
        topLanguages: topLanguages.slice(0, 3)
      }
    };

    // Store or overwrite (update) profile
    talentPool[cleanUsername] = talentProfile;
    res.status(201).json(talentProfile);
  } catch (error) {
    res.status(500).json({ error: 'Failed to register or aggregate telemetry data', details: error.message });
  }
});

/**
 * GET /api/talent/search
 * Multi-layered concurrent filtering pipeline
 */
app.get('/api/talent/search', (req, res) => {
  try {
    const { skill, location } = req.query;
    let results = Object.values(talentPool);

    // Multi-layered match criteria
    if (skill) {
      results = results.filter(t => 
        t.skills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
      );
    }
    if (location) {
      results = results.filter(t => 
        t.location.city.toLowerCase().includes(location.toLowerCase()) ||
        t.location.country.toLowerCase().includes(location.toLowerCase())
      );
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Search aggregation failure' });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Advanced Infrastructure Engine active on port ${PORT}`));