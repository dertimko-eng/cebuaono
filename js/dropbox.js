// Dropbox-Anbindung: OAuth 2 mit PKCE (kein Secret), App-Folder-Berechtigung,
// Refresh-Token verschlüsselt (AES-GCM, Schlüssel nicht exportierbar) in IndexedDB.
//
// Zwei Wege zur Anmeldung:
//  1. Redirect-Flow (Safari/Desktop): Dropbox leitet mit ?code= zurück auf die App.
//  2. Code-Eingabe (iOS Home-Bildschirm/standalone): Dropbox zeigt den Code an, der Nutzer
//     kopiert ihn in die App. Nötig, weil der Redirect sonst in Safari statt in der PWA landet
//     und Safari und die PWA getrennte Speicher haben.
import { db } from "./db.js";
import { CONFIG } from "./config.js";

const AUTH_URL = "https://www.dropbox.com/oauth2/authorize";
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const API = "https://api.dropboxapi.com/2";
const CONTENT = "https://content.dropboxapi.com/2";

function b64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function sha256(str) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
}
function randomString(len = 64) {
  const a = crypto.getRandomValues(new Uint8Array(len));
  return b64url(a).slice(0, len);
}

// ---------- Verschlüsselung ----------
async function getKey() {
  let key = await db.kvGet("dbx.key");
  if (!key) {
    key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await db.kvSet("dbx.key", key);
  }
  return key;
}
async function encrypt(obj) {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return { iv: Array.from(iv), ct: Array.from(new Uint8Array(ct)) };
}
async function decrypt(blob) {
  if (!blob) return null;
  try {
    const key = await getKey();
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(blob.iv) }, key, new Uint8Array(blob.ct));
    return JSON.parse(new TextDecoder().decode(pt));
  } catch (e) {
    console.warn("Token nicht lesbar", e);
    return null;
  }
}

export class DropboxClient {
  constructor() {
    this.appKey = CONFIG.DROPBOX_APP_KEY;
    this.tokens = null; // {access_token, refresh_token, expires_at, account_id}
    this.loaded = false;
  }

  isConfigured() {
    return !!this.appKey;
  }

  async load() {
    if (!this.loaded) {
      this.tokens = await decrypt(await db.kvGet("dbx.tokens"));
      this.loaded = true;
    }
    return this.tokens;
  }

  async isConnected() {
    await this.load();
    return !!(this.tokens && this.tokens.refresh_token);
  }

  async saveTokens(t) {
    this.tokens = t;
    await db.kvSet("dbx.tokens", await encrypt(t));
  }

  async disconnect() {
    try {
      if (this.tokens?.access_token) {
        await fetch(API + "/auth/token/revoke", { method: "POST", headers: { Authorization: "Bearer " + this.tokens.access_token } });
      }
    } catch (_) {}
    this.tokens = null;
    await db.kvDel("dbx.tokens");
  }

  redirectUri() {
    const u = new URL(location.href);
    u.search = "";
    u.hash = "";
    if (!u.pathname.endsWith("index.html")) u.pathname = u.pathname.replace(/\/?$/, "/index.html");
    return u.toString();
  }

  /**
   * Startet die Anmeldung.
   * @param {{manual:boolean}} opts manual=true: Code-Eingabe (für iOS-Standalone)
   * @returns {Promise<string>} die Autorisierungs-URL (bei manual) – sonst wird direkt umgeleitet
   */
  async startAuth({ manual = false } = {}) {
    if (!this.appKey) throw new Error("Kein Dropbox-App-Key in js/config.js eingetragen.");
    const verifier = randomString(64);
    const challenge = b64url(await sha256(verifier));
    const state = randomString(16);
    await db.kvSet("dbx.pkce", { verifier, state, manual, t: Date.now() });
    const p = new URLSearchParams({
      client_id: this.appKey,
      response_type: "code",
      code_challenge: challenge,
      code_challenge_method: "S256",
      token_access_type: "offline",
      state,
    });
    if (!manual) p.set("redirect_uri", this.redirectUri());
    const url = AUTH_URL + "?" + p.toString();
    if (manual) return url;
    location.assign(url);
    return url;
  }

  // Prüft beim Start, ob ?code= in der URL steht (Redirect-Flow) und tauscht ihn ein.
  async handleRedirect() {
    const u = new URL(location.href);
    const code = u.searchParams.get("code");
    if (!code) return false;
    const state = u.searchParams.get("state");
    const pkce = await db.kvGet("dbx.pkce");
    // URL sofort bereinigen
    u.searchParams.delete("code");
    u.searchParams.delete("state");
    history.replaceState(null, "", u.pathname + u.hash);
    if (!pkce || pkce.state !== state) throw new Error("Anmeldung abgebrochen: state passt nicht (bitte erneut verbinden).");
    await this.exchangeCode(code, pkce.verifier, this.redirectUri());
    await db.kvDel("dbx.pkce");
    return true;
  }

  async finishManualCode(code) {
    const pkce = await db.kvGet("dbx.pkce");
    if (!pkce) throw new Error("Bitte zuerst „Mit Dropbox verbinden“ antippen.");
    await this.exchangeCode(code.trim(), pkce.verifier, null);
    await db.kvDel("dbx.pkce");
  }

  async exchangeCode(code, verifier, redirectUri) {
    const body = new URLSearchParams({ code, grant_type: "authorization_code", code_verifier: verifier, client_id: this.appKey });
    if (redirectUri) body.set("redirect_uri", redirectUri);
    const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const j = await r.json();
    if (!r.ok) throw new Error("Dropbox-Anmeldung fehlgeschlagen: " + (j.error_description || j.error || r.status));
    await this.saveTokens({
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: Date.now() + (j.expires_in - 60) * 1000,
      account_id: j.account_id,
    });
  }

  async accessToken() {
    await this.load();
    if (!this.tokens?.refresh_token) throw new Error("Nicht mit Dropbox verbunden.");
    if (this.tokens.access_token && this.tokens.expires_at > Date.now()) return this.tokens.access_token;
    const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: this.tokens.refresh_token, client_id: this.appKey });
    const r = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const j = await r.json();
    if (!r.ok) {
      if (j.error === "invalid_grant") {
        await this.disconnect();
        throw new Error("Dropbox-Verbindung abgelaufen – bitte neu verbinden.");
      }
      throw new Error("Token-Erneuerung fehlgeschlagen: " + (j.error_description || j.error));
    }
    await this.saveTokens({ ...this.tokens, access_token: j.access_token, expires_at: Date.now() + (j.expires_in - 60) * 1000 });
    return this.tokens.access_token;
  }

  async rpc(path, arg) {
    const token = await this.accessToken();
    const r = await fetch(API + path, {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(arg || null),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`Dropbox ${path}: ${r.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  }

  async accountName() {
    const a = await this.rpc("/users/get_current_account");
    return a?.name?.display_name || a?.email || "Dropbox";
  }

  async upload(path, text) {
    const token = await this.accessToken();
    const r = await fetch(CONTENT + "/files/upload", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({ path, mode: "overwrite", mute: true }),
      },
      body: new Blob([text], { type: "application/octet-stream" }),
    });
    if (!r.ok) throw new Error(`Upload ${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }

  // Liefert den Text der Datei oder null, wenn sie nicht existiert.
  async download(path) {
    const token = await this.accessToken();
    const r = await fetch(CONTENT + "/files/download", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Dropbox-API-Arg": JSON.stringify({ path }) },
    });
    if (r.status === 409) {
      const t = await r.text();
      if (t.includes("not_found")) return null;
      throw new Error(`Download ${path}: ${t.slice(0, 200)}`);
    }
    if (!r.ok) throw new Error(`Download ${path}: ${r.status}`);
    return r.text();
  }
}

export const dropbox = new DropboxClient();
