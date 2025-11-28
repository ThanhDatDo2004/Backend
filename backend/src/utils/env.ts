const DEFAULT_FRONTEND_BASE = "https://thuere.site";

export function resolveFrontendBaseUrl() {
  const raw =
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    process.env.CLIENT_APP_URL ||
    DEFAULT_FRONTEND_BASE;

  return raw.replace(/\/+$/, "");
}

const envUtils = {
  resolveFrontendBaseUrl,
};

export default envUtils;
