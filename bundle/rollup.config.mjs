// rollup.config.js

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

export default {
  input: 'ar.js',
  output: {
    file: 'ar.bundle.js',
    format: 'iife', // Immediately Invoked Function Expression
    name: 'ARModule', // Global variable name
    plugins: [terser()]
  },
  plugins: [
    resolve(),
    commonjs(),
  ],
};
