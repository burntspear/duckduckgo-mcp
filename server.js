const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).send('Missing query parameter');

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

    // 3. KnowYourMeme search link (dynamic for any query)
    const kymSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + " site:knowyourmeme.com")}`;

    // Unified response
    res.json({
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
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching data');
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));