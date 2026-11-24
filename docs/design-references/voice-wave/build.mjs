import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const output = process.argv[2];
if (!output) throw new Error('데모를 저장할 출력 디렉터리가 필요합니다.');

const result = await build({
  root: directory,
  configFile: false,
  logLevel: 'error',
  resolve: {
    alias: [{ find: '@get-bb/plugin-sdk/app', replacement: path.join(directory, 'sdk-demo.tsx') }],
  },
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    write: false,
    lib: { entry: path.join(directory, 'demo.tsx'), name: 'ComposerVoiceDemo', formats: ['iife'] },
  },
});

const code = (Array.isArray(result) ? result : [result])
  .flatMap(bundle => bundle.output)
  .filter(item => item.type === 'chunk')
  .map(item => item.code)
  .join('\n');
const html = readFileSync(path.join(directory, 'index.html'), 'utf8');
const licenses = ['react', 'react-dom'].map(name => readFileSync(path.join(root, 'node_modules', name, 'LICENSE'), 'utf8')).join('\n');
mkdirSync(output, { recursive: true });
writeFileSync(path.join(output, 'index.html'), html.replace('<!-- demo script -->', () =>
  '<script>/*!\n' + licenses + '\n*/\n' + code.replace(/<\/script/gi, '<\\/script') + '</script>',
));
console.log(path.resolve(output, 'index.html'));
