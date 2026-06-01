import { useState, useEffect } from 'react';
import { tweetsApi } from 'exo-shared';

export function useTimeline() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = () => {
    setLoading(true);
    tweetsApi.listTweets()
      .then(data => setPosts(data.tweets || []))
      .catch(err => console.error('Timeline load failed', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPosts(); }, []);

  return { posts, loading, refresh: fetchPosts };
}
