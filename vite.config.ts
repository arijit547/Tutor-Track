import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	base: "/",
	build: {
		rollupOptions: {
			input: {
				index: path.resolve(__dirname, 'index.html'),
				'firebase-messaging-sw': path.resolve(__dirname, 'firebase-messaging-sw.js'),
			},
			output: {
				entryFileNames: chunk => chunk.name === 'firebase-messaging-sw'
					? 'firebase-messaging-sw.js' : 'assets/[name]-[hash].js',
			},
		},
	},
	server: {
		port: 3000,
		host: "0.0.0.0",
		proxy: { '/api': 'http://127.0.0.1:3001' },
	},
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
});
