// Asserts that every code sample printed in a package README is the exact code
// that CI compiles.
//
// Typechecking `examples/` proves the samples are valid. It does not prove the
// README shows them: the two could drift, and the README is the copy people
// actually paste. So each example file marks the region that must appear in the
// README with `// README:begin` / `// README:end`, and this compares them
// verbatim.
//
// The only permitted difference is the import specifier, because an example
// inside the repo imports from source while a reader imports the package.

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
