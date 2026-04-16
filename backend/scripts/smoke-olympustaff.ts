import 'reflect-metadata';
import { OlympusStaffPlugin } from '../src/scraper/plugins/olympustaff.plugin';

async function main() {
  const p = new OlympusStaffPlugin();

  console.log('=== getLatestManga(0) ===');
  const list = await p.getLatestManga(0);
  console.log(`count=${list.length}`);
  console.log(list.slice(0, 3));

  const detailUrl = 'https://olympustaff.com/series/eat-and-go';
  console.log('\n=== getMangaDetail ===');
  const detail = await p.getMangaDetail(detailUrl);
  console.log(detail);

  console.log('\n=== getChapterList ===');
  const chapters = await p.getChapterList(detailUrl);
  console.log(`count=${chapters.length}`);
  console.log('first 3:', chapters.slice(0, 3));
  console.log('last 3:', chapters.slice(-3));

  console.log('\n=== getPageList (chapter 1) ===');
  const pages = await p.getPageList('https://olympustaff.com/series/eat-and-go/1');
  console.log(`count=${pages.length}`);
  console.log('first:', pages[0]);
  console.log('last:', pages[pages.length - 1]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
