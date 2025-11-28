const DEFAULT_FRONTEND_BASE = "https://thuere.site";

export function resolveFrontendBaseUrl() {
  const raw = DEFAULT_FRONTEND_BASE;

  return raw.replace(/\/+$/, "");
}

const envUtils = {
  resolveFrontendBaseUrl,
};

export default envUtils;
