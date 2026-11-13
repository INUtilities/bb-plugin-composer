import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const here = import.meta.dirname;
const root = path.resolve(here, '../../..');
const out = process.argv[2];
if (!out || !path.isAbsolute(out)) throw new Error('출력 폴더의 절대경로를 지정하세요.');
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'gallery-manifest.json'), 'utf8'));
const snapshot = path.join(out, 'snapshot');
fs.mkdirSync(snapshot, { recursive: true });
// 보관 기준 커밋의 제품 코드만 검수 폴더로 추출한다.
const archive = execFileSync('git', ['archive', manifest.baseCommit, 'composer', 'lib'], { cwd:root, maxBuffer:16 * 1024 * 1024 });
execFileSync('tar', ['-xf', '-'], { cwd:snapshot, input:archive });
const esbuild = createRequire(path.join(root, '../bb-plugin-codes/package.json'))('esbuild');
const reviewCommit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd:root, encoding:'utf8' }).trim();
const input = fs.readFileSync(path.join(here, 'slot-review.tsx'), 'utf8');
const source = input.replaceAll('__SNAP__', snapshot.replaceAll('\\', '/'))
  .replaceAll('__COMMIT__', manifest.baseCommit.slice(0, 7)).replaceAll('__REVIEW_COMMIT__', reviewCommit);
const bundle = await esbuild.build({
  stdin:{ contents:source, sourcefile:'slot-review.tsx', resolveDir:snapshot, loader:'tsx' },
  bundle:true, write:false, format:'iife', platform:'browser', target:'es2022', minify:true, jsx:'automatic',
  loader:{ '.css':'empty' }, define:{ 'process.env.NODE_ENV':'"production"' },
  alias:{ '@':path.join(snapshot, 'composer') }, nodePaths:[path.join(root, 'node_modules')], logLevel:'warning',
});
const archivedHtml = fs.readFileSync(path.join(here, 'gallery.html'), 'utf8');
const archivedCss = archivedHtml.match(/<style>([\s\S]*?)<\/style>/)?.[1];
if (!archivedCss) throw new Error('보관 HTML의 기준 CSS가 없습니다.');
const reviewCss = fs.readFileSync(path.join(here, 'slot-review.css'), 'utf8');
const html = '<!doctype html><html lang="ko" data-bb-chat-ui-root-device="phone"><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>06 · 컴포저 설정 비교</title>'
  + '<style>' + archivedCss + '\n' + reviewCss + '</style></head><body><div id="app" data-bb-plugin="bb-chat-ui"></div><script>'
  + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script></body></html>';
fs.writeFileSync(path.join(out, 'index.html'), html);
// 검수 소스와 독립 HTML의 일치 여부를 확인할 해시를 기록한다.
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify({
  productCommit:manifest.baseCommit, reviewCommit, sourceSha:sha(input), cssSha:sha(reviewCss), outputSha:sha(html),
  productModified:false, remoteCalls:false,
}, null, 2));
console.log('SLOT_REVIEW_BUILT', reviewCommit, Math.round(html.length / 1024) + 'KB');
