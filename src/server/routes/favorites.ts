/**
 * Favorites — per-user "I'd recommend this" markers + the cross-user
 * Recommended feed.
 *
 * Routes:
 *   POST   /api/favorites               body: { seriesId }     → 201
 *   DELETE /api/favorites/:seriesId                            → 204
 *   GET    /api/favorites               (current user, full SeriesRecord[])
 *   GET    /api/favorites/recommended   (aggregated cross-user, NSFW-filtered)
 *
 * The Recommended feed always strips NSFW series regardless of viewer admin
 * status — the social-feature surface stays clean for shared/family contexts.
 * Admins can still discover anyone's NSFW interests via library browsing if
 * needed; this is the recommendation surface, not a permissions surface.
 */
import { Router } from 'express';
import {
  loadAllSeries,
  getSeries,
  loadFavorites,
  loadAllFavorites,
  addFavorite,
  removeFavorite,
  isNsfwSeries,
  type SeriesRecord,
} from '../data.js';

const router = Router();

// POST /api/favorites { seriesId } — toggle on
router.post('/favorites', (req, res) => {
  const seriesId = String(req.body?.seriesId || '').trim();
  if (!seriesId) {
    res.status(400).json({ error: 'seriesId required' });
    return;
  }
  const series = getSeries(seriesId);
  if (!series) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }
  addFavorite(req.username, seriesId);
  res.status(201).json({ ok: true });
});

// DELETE /api/favorites/:seriesId — toggle off
router.delete('/favorites/:seriesId', (req, res) => {
  removeFavorite(req.username, req.params.seriesId);
  res.status(204).end();
});

// GET /api/favorites — current user's favorites, hydrated to full series records
router.get('/favorites', (req, res) => {
  const entries = loadFavorites(req.username);
  const allSeries = loadAllSeries();
  const seriesById = new Map(allSeries.map((s) => [s.id, s]));
  const hydrated: SeriesRecord[] = [];
  for (const e of entries) {
    const s = seriesById.get(e.seriesId);
    if (s) hydrated.push(s);
  }
  res.json(hydrated);
});

// GET /api/favorites/recommended — aggregated cross-user feed
//
// Response: [{ series, favoritedBy: username[], count }]
// Sort: count desc, then most-recent favoritedAt desc as tiebreaker
// NSFW: always filtered, regardless of viewer
router.get('/favorites/recommended', (req, res) => {
  const all = loadAllFavorites();
  if (all.length === 0) {
    res.json([]);
    return;
  }

  // Aggregate: seriesId → { usernames: Set, latestFavoritedAt: ISO string }
  const agg = new Map<string, { usernames: Set<string>; latestAt: string }>();
  for (const { username, seriesId, favoritedAt } of all) {
    const cur = agg.get(seriesId);
    if (!cur) {
      agg.set(seriesId, { usernames: new Set([username]), latestAt: favoritedAt });
    } else {
      cur.usernames.add(username);
      if (favoritedAt > cur.latestAt) cur.latestAt = favoritedAt;
    }
  }

  // Hydrate to series records, drop NSFW + missing-series
  const allSeries = loadAllSeries();
  const seriesById = new Map(allSeries.map((s) => [s.id, s]));
  const out: Array<{
    series: SeriesRecord;
    favoritedBy: string[];
    count: number;
    latestAt: string;
  }> = [];

  for (const [seriesId, { usernames, latestAt }] of agg) {
    const series = seriesById.get(seriesId);
    if (!series) continue;          // dangling — series was deleted but cascade missed
    if (isNsfwSeries(series)) continue; // hard filter
    out.push({
      series,
      favoritedBy: [...usernames].sort(),
      count: usernames.size,
      latestAt,
    });
  }

  // Sort: count desc, then recency desc as tiebreaker
  out.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.latestAt < a.latestAt ? -1 : b.latestAt > a.latestAt ? 1 : 0;
  });

  // Strip the latestAt from the response (only used for sort)
  res.json(out.map(({ series, favoritedBy, count }) => ({ series, favoritedBy, count })));
});

export default router;
