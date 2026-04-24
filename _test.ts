import { mangahubSource } from './src/server/sources/mangahub.js';

async function main() {
  try {
    const results = await mangahubSource.search('chainsaw man', 3);
    console.log('MangaHub search:', results.length, 'results');
    if (results.length > 0) console.log(JSON.stringify(results[0], null, 2));
  } catch (e) {
    console.error('FAIL:', (e as Error).message);
  }
}
main();
