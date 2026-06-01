import React from 'react';
import { useTimeline } from '../hooks/useTimeline';
import Timeline from '../components/Timeline';

export default function TimelineView() {
  const { posts, loading, refresh } = useTimeline();
  if (loading) return <div className="p-6 text-chron-muted">Loading timeline...</div>;
  return (
    <div className="h-full overflow-y-auto p-4">
      <Timeline posts={posts} onRefresh={refresh} />
    </div>
  );
}
