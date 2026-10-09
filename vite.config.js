import basicSsl from '@vitejs/plugin-basic-ssl';

// WebXR needs a secure context: self-signed HTTPS for the Quest browser.
export default {
  plugins: [basicSsl()],
  server: { host: true },
  build: { rollupOptions: { input: { main: 'index.html', viewer: 'viewer.html' } } },
};
