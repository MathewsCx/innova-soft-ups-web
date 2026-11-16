import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

function precacheManifest() {
    return {
        name: "static-precache-manifest",
        generateBundle(_, bundle) {
            const builtAssets = [
                "index.html",
                ...Object.keys(bundle).filter((file) => /\.(?:js|css)$/.test(file))
            ];
            const publicAssets = [
                "icons/icon.svg",
                "icons/icon-192.png",
                "icons/icon-512.png",
                "manifest.webmanifest"
            ];
            const files = [...builtAssets, ...publicAssets]
                .map((file) => `./${file}`);

            this.emitFile({
                type: "asset",
                fileName: "precache-manifest.json",
                source: JSON.stringify(files)
            });
        }
    };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const apiTarget = env.API_PROXY_TARGET || "http://127.0.0.1:3000";
    const apiProxy = {
        "/api": {
            target: apiTarget,
            changeOrigin: true
        }
    };

    return {
        base: "./",
        plugins: [vue(), precacheManifest()],
        server: { proxy: apiProxy },
        preview: { proxy: apiProxy },
        build: {
            outDir: "dist",
            emptyOutDir: true
        }
    };
});
