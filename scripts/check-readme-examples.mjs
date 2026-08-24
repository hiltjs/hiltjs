// Asserts that the code printed in a package README is the code CI compiles.
// Examples mark the region with `// README:begin` / `// README:end`; the only
// permitted difference is the import specifier.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES = [{ dir: 'packages/core', specifier: '@hiltjs/core' }];

let failures = 0;

for (const { dir, specifier } of PACKAGES) {
  const readme = readFileSync(join(dir, 'README.md'), 'utf8');
  const examplesDir = join(dir, 'examples');

  for (const file of readdirSync(examplesDir)
    .filter((f) => f.endsWith('.ts'))
    .sort()) {
    const source = readFileSync(join(examplesDir, file), 'utf8');
    const marked = source.match(/\/\/ README:begin\n([\s\S]*?)\/\/ README:end/);

    if (!marked) {
      console.error(`FAIL ${dir}/examples/${file}: no // README:begin block`);
      failures++;
      continue;
    }

    const expected = marked[1].replace(/'\.\.\/src\/index'/g, `'${specifier}'`).trim();

    if (readme.includes(expected)) {
      console.log(`ok   ${dir}/examples/${file} appears verbatim in README.md`);
    } else {
      console.error(
        `FAIL ${dir}/examples/${file} does not appear in ${dir}/README.md.\n` +
          `The README must contain this exactly:\n\n${expected}\n`,
      );
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} README example(s) out of sync.`);
  process.exit(1);
}
console.log('\nEvery compiled example is printed in its README.');
