// Konfiguration – hier den App-Key aus der Dropbox-Developer-Konsole eintragen (siehe README).
export const CONFIG = {
  // App-Key der Dropbox-App (kein Secret! PKCE braucht nur den Key)
  DROPBOX_APP_KEY: "",
  // Dateinamen im Dropbox-App-Ordner
  DROPBOX_PROGRESS_FILE: "/progress.json",
  DROPBOX_EVENTS_FILE: "/events.json",
  APP_VERSION: "1.0.0",
};
