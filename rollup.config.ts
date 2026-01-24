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
