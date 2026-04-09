import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || './data';
const SHELVES_PATH = path.join(DATA_DIR, 'shelves.json');

export interface Shelf {
  id: string;
  name: string;
  path: string;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadShelves(): Shelf[] {
  if (fs.existsSync(SHELVES_PATH)) {
    return JSON.parse(fs.readFileSync(SHELVES_PATH, 'utf-8'));
  }
  return [];
}

function saveShelves(shelves: Shelf[]) {
  ensureDataDir();
  fs.writeFileSync(SHELVES_PATH, JSON.stringify(shelves, null, 2));
}

export function addShelf(name: string, folderPath: string): Shelf {
  const shelves = loadShelves();

  // Validate folder exists
  const resolvedPath = path.resolve(folderPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Folder does not exist: ${resolvedPath}`);
  }

  // Generate ID from name
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // Check for duplicate
  if (shelves.some((s) => s.id === id)) {
    throw new Error(`Shelf "${name}" already exists`);
  }

  const shelf: Shelf = { id, name, path: resolvedPath };
  shelves.push(shelf);
  saveShelves(shelves);
  return shelf;
}

export function removeShelf(id: string): boolean {
  const shelves = loadShelves();
  const idx = shelves.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  shelves.splice(idx, 1);
  saveShelves(shelves);
  return true;
}

export function getShelf(id: string): Shelf | undefined {
  return loadShelves().find((s) => s.id === id);
}
