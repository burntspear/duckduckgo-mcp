const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

// Define the manifest (tool list)
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

// JSON-RPC dispatcher
app.post('/mcp', async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  // 🔍 Log the full incoming request body
  console.log("Incoming MCP request:", JSON.stringify(req.body, null, 2));

  const { jsonrpc, id, method, params } = req.body;

  if (jsonrpc !== "2.0") {
    return res.json({ jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid JSON-RPC version" } });
  }

  try {
    switch (method) {
      case "tools/list":
      case "tool.list": // allow alias if n8n uses this
        return res.json({
          jsonrpc: "2.0",
          id,
          result: manifestResponse
        });

      case "tools/call":
      case "tool.call": // allow alias if n8n uses this
        if (!params || !params.name) {
          return res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "Missing tool name" } });
        }

        if (params.name === "search") {
          const { query } = params.arguments || {};
          if (!query) {
            return res.json({ jsonrpc: "2.0", id, error: { code: -32602, message: "Missing query parameter" } });
          }

          // 1. Reddit search
          const redditResponse = await axios.get(
            `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=20`
          );
          const redditResults = redditResponse.data.data.children.map(post => ({
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

          return res.json({
            jsonrpc: "2.0",
            id,
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
        } else {
          return res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Unknown tool" } });
        }

      default:
        return res.json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Unknown method" } });
    }
  } catch (error) {
    console.error("Internal error:", error);
    return res.json({ jsonrpc: "2.0", id, error: { code: -32603, message: "Internal error" } });
  }
});

// Simple browser test route
app.get('/search', (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).send('Missing query parameter');
  res.send(`Search route hit with query: ${query}`);
});

app.listen(PORT, () => console.log(`MCP server running on port ${PORT}`));