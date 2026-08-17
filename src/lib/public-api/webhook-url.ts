const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "[::1]"]);

export class WebhookUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookUrlError";
  }
}

function ipv4Octets(hostname: string) {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return null;
  const octets = match.slice(1).map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
}

function isPrivateIpv4(octets: number[]) {
  const [first, second] = octets;
  if (first === 10 || first === 127 || first === 0) return true;
  if (first === 169 && second === 254) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return false;
}

function isPrivateIpv6(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:") ||
    host.startsWith("::ffff:127.") ||
    host.startsWith("::ffff:10.") ||
    host.startsWith("::ffff:192.168.") ||
    host.startsWith("::ffff:169.254.")
  );
}

export function isPrivateWebhookHostname(hostname: string) {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  if (LOOPBACK_HOSTS.has(host)) return true;
  const octets = ipv4Octets(host);
  if (octets) return isPrivateIpv4(octets);
  return isPrivateIpv6(host);
}

export function validateWebhookUrl(raw: string, environment: Pick<NodeJS.ProcessEnv, "NODE_ENV"> = process.env) {
  const trimmed = raw.trim();
  if (!trimmed) throw new WebhookUrlError("Enter a webhook URL.");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new WebhookUrlError("Enter a valid absolute webhook URL.");
  }

  if (url.username || url.password) {
    throw new WebhookUrlError("Webhook URLs cannot include credentials.");
  }

  const allowHttp = environment.NODE_ENV !== "production";
  if (url.protocol === "http:") {
    if (!allowHttp) throw new WebhookUrlError("Webhook URLs must use HTTPS.");
  } else if (url.protocol !== "https:") {
    throw new WebhookUrlError("Webhook URLs must use http or https.");
  }

  if (isPrivateWebhookHostname(url.hostname)) {
    throw new WebhookUrlError("Webhook URLs cannot target a private or loopback address.");
  }

  url.hash = "";
  return url.toString();
}
