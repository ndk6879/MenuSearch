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
};
