// import parsers first so they self-register
import './languages/javascript';

import { collectFiles } from './stages/collector';
import { parseFiles }   from './stages/parser';

const files  = collectFiles('./src');
const parsed = parseFiles(files);

for (const file of parsed) {
  console.log(`\n${file.filePath}  [${file.lang}]`);
  console.log(`  entities: ${file.entities.map(e => e.name).join(', ')}`);
  console.log(`  imports:  ${file.imports.map(i => i.source).join(', ')}`);
}