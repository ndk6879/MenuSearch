const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function (app) {
  app.use(
    "/es",
    createProxyMiddleware({
      target: "http://localhost:9200",
      changeOrigin: true,
      pathRewrite: {
        "^/es": ""
      }
    })
  );
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://127.0.0.1:8000",
      changeOrigin: true,
    })
  );
};
