// Reproducible, offline-at-runtime calculator bundle:
// npm install --prefix /tmp/pokeleague-prep-repair @smogon/calc@0.12.0 esbuild@0.25.10
// NODE_PATH=/tmp/pokeleague-prep-repair/node_modules node scripts/build-prep-calc.cjs
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const pkg = require('@smogon/calc/package.json');
if (pkg.version !== '0.12.0') throw new Error('Expected @smogon/calc 0.12.0');
esbuild.build({
  entryPoints: [path.join(__dirname, 'prep-calc-entry.cjs')],
  outfile: path.join(__dirname, '../js/vendor/prep-calc.js'),
  bundle: true, minify: true, format: 'iife', globalName: 'calc',
  nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
  banner: { js: '/*! @smogon/calc 0.12.0 | MIT | see prep-calc.LICENSE */' },
  plugins: [{
    name: 'expose-upstream-end-of-turn',
    setup(build) {
      // Export the existing upstream function, without changing its mechanics.
      // Our weighted KO distribution needs exactly the same weather/status recovery.
      build.onLoad({ filter: /@smogon[\\/]calc[\\/]dist[\\/]desc\.js$/ }, args => ({
        contents: fs.readFileSync(args.path, 'utf8') + '\nexports.getEndOfTurn = getEndOfTurn;\n',
        loader: 'js', resolveDir: path.dirname(args.path),
      }));
    },
  }],
}).catch(error => { console.error(error); process.exitCode = 1; });
