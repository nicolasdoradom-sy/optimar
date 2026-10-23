import { defineConfig } from 'vite';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.VITE_BASE_PATH || (repositoryName ? `/${repositoryName}/` : '/');

export default defineConfig({
  base,
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});