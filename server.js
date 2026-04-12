const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Manifest payload
const manifestResponse = {
  version: "1.0.0",
  tools: [
    {
      name: "search",
      description: "Search memes using Reddit, DuckDuckGo, and KnowYourMeme",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string" }
        },
        required: ["query"]
      }
    }
  ]
};

// MCP manifest route (GET + POST) with JSON-RPC 2.0 envelope
app.get('/mcp/manifest', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    jsonrpc: "2.0",
    id: 1,
    result: manifestResponse
  });
});

app.post('/mcp/manifest', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    jsonrpc: "2.0",
    id: 1,
    result: manifestResponse
  });
});

// MCP tool execution route with JSON-RPC 2.0 envelope
app.post('/mcp/tools/search', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32602, message: "Missing query parameter" }
    });
  }

  try {
    // 1. Reddit chatter
    const redditResponse = await axios.get(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=20`
    );
    const redditData = redditResponse.data;
    const redditResults = redditData.data.children.map(post => ({
      title: post.data.title,
      url: 'https://reddit.com' + post.data.permalink,
      subreddit: post.data.subreddit,
      upvotes: post.data.ups
    })).slice(0, 10);

    // 2. DuckDuckGo factual context
    const ddgResponse = await axios.get(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`
    );
    const ddgData = ddgResponse.data;
    const factualResults = ddgData.RelatedTopics
      ? ddgData.RelatedTopics.slice(0, 5).map(t => ({
          title: t.Text,
          url: t.FirstURL
        }))
      : [];

    // 3. KnowYourMeme search link
    const kymSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + " site:knowyourmeme.com")}`;

    // MCP-compliant JSON-RPC response envelope
    res.json({
      jsonrpc: "2.0",
      id: 1,
      result: {
        output: [
          {
            content: [
              {
                type: "json",
                json: {
                  query,
                  factual: {
                    heading: ddgData.Heading || '',
                    source: ddgData.AbstractSource || '',
                    count: factualResults.length,
                    results: factualResults
                  },
                  reddit: {
                    count: redditResults.length,
                    results: redditResults
                  },
                  knowYourMeme: {
                    searchUrl: kymSearchUrl
                  }
                }
              }
            ]
          }
        ]
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32603, message: "Error fetching data" }
    });
  }
});

// Simple search route for browser testing
app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).send('Missing query parameter');
  res.send(`Search route hit with query: ${query}`);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));