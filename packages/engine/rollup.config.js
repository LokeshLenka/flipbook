import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: [
    { file: 'dist/index.esm.js', format: 'es' },
    { file: 'dist/index.js', format: 'umd', name: 'FlipBook', globals: { jquery: 'jQuery', three: 'THREE', pdfjs: 'PDFJS', html2canvas: 'html2canvas' } }
  ],
  plugins: [
    resolve({ browser: true }),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json', declaration: true, declarationDir: 'dist' })
  ],
  external: ['jquery', 'three', 'pdfjs', 'html2canvas']
};
