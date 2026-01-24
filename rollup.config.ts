/**
 * Rollup configuration for bundling the GitHub Action
 * @see https://rollupjs.org/configuration-options/
 */
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const config = {
  input: 'src/index.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true,
  },
  // Suppress known warnings from dependencies
  onwarn(warning, warn) {
    // Ignore circular dependency warning from @actions/core (known issue in GitHub's package)
    if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.ids?.some((id) => id.includes('@actions/core'))) {
      return;
    }
    // Ignore "this" rewritten to "undefined" in node_modules (common in CJS packages)
    if (warning.code === 'THIS_IS_UNDEFINED' && warning.id?.includes('node_modules')) {
      return;
    }
    warn(warning);
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      outputToFilesystem: false,
      declaration: false,
      declarationMap: false,
    }),
    nodeResolve({
      preferBuiltins: true,
      exportConditions: ['node'],
    }),
    commonjs(),
    json(),
  ],
};

export default config;
