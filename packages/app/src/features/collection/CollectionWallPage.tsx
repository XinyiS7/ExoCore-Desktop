import { Outlet } from 'react-router-dom';

/** P4 Library: the Collection wall; item detail renders through the nested outlet. */
export function CollectionWallPage() {
  return (
    <section className="library-page" aria-labelledby="library-title">
      <h1 id="library-title">Library</h1>
      <Outlet />
    </section>
  );
}
