import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// main.go defaults to :7000, but macOS AirPlay Receiver squats on that port, so
// the npm scripts publish it on 7010 and this follows suit. Override with
// ORBITAL_BACKEND to point anywhere else.
const BACKEND = process.env.ORBITAL_BACKEND ?? "http://127.0.0.1:7010";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5190,
    // The Go backend owns the UDP socket and fans events out over SSE; a browser
    // cannot receive UDP itself. Proxying keeps the stream same-origin in dev.
    proxy: {
      "/stream": { target: BACKEND, changeOrigin: true },
      "/healthz": { target: BACKEND, changeOrigin: true },
      "/stats": { target: BACKEND, changeOrigin: true },
    },
  },
});
