import preprocess from 'svelte-preprocess';
import svemix from './src/lib/plugin/index.js';

/** @type {import('./dist').SvemixConfig} */
const config = {
	preprocess: [preprocess()],
	svemix: {
		seo: {
			title: 'Override me',
			description: 'Default description'
		}
	},
	kit: {
		package: {
			dir: 'dist',
			exports: (filepath) => {
				const splitted_path = filepath.split('/');
				if (filepath.endsWith('.d.ts')) return true;
				if (splitted_path.length > 2) return false;
				if (filepath.includes('index')) return true;
				return false;
			}
		},
		vite: {
			plugins: [svemix()]
		}
	}
};

export default config;
