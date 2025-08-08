# Discord OAuth2 & Auto-Join Setup

## Was diese Integration macht:
- ✅ Benutzer können sich mit Discord einloggen
- ✅ Benutzer werden automatisch deinem Discord-Server hinzugefügt
- ✅ Wenn ein Benutzer den Server verlässt und die Website besucht, wird er automatisch wieder hinzugefügt
- ✅ Die Benutzerdaten (Name, Avatar, ID) werden in der Session gespeichert

## Voraussetzungen im Discord Developer Portal:

### 1. Discord Application erstellen
1. Gehe zu [Discord Developer Portal](https://discord.com/developers/applications)
2. Klicke auf "New Application"
3. Gib deiner App einen Namen (z.B. "DonutMarket")

### 2. OAuth2 Einstellungen
1. Gehe zu **OAuth2 → General**
2. Füge diese Redirect URI hinzu:
   ```
   http://localhost:3000/auth/discord/callback
   ```
   (Für Produktion: `https://deine-domain.com/auth/discord/callback`)

### 3. Bot erstellen
1. Gehe zu **Bot**
2. Klicke auf "Add Bot"
3. Kopiere den **Bot Token** (brauchst du für `.env`)
4. Unter "Privileged Gateway Intents" aktiviere:
   - ✅ SERVER MEMBERS INTENT (wichtig!)

### 4. Bot zum Server einladen
1. Gehe zu **OAuth2 → URL Generator**
2. Wähle diese Scopes:
   - ✅ `bot`
   - ✅ `applications.commands` (optional)
3. Wähle diese Bot Permissions:
   - ✅ `Create Instant Invite`
   - ✅ `Manage Roles` (falls du später Rollen vergeben willst)
4. Kopiere die generierte URL und öffne sie
5. Wähle deinen Server aus und füge den Bot hinzu

### 5. Client Credentials kopieren
1. Gehe zu **OAuth2 → General**
2. Kopiere die **Client ID**
3. Kopiere das **Client Secret** (Reset Secret wenn nötig)

## .env Datei konfigurieren:
```env
# Discord OAuth2 Credentials
DISCORD_CLIENT_ID=deine_client_id_hier
DISCORD_CLIENT_SECRET=dein_client_secret_hier

# Discord Bot Token (vom Bot-Tab)
DISCORD_BOT_TOKEN=dein_bot_token_hier

# Discord Server ID (Rechtsklick auf deinen Server → ID kopieren)
DISCORD_GUILD_ID=deine_server_id_hier

# Session Secret (beliebiger zufälliger String)
SESSION_SECRET=ein-sehr-sicherer-zufaelliger-schluessel-12345
```

## Server ID finden:
1. Aktiviere den Entwicklermodus in Discord (Einstellungen → Erweitert → Entwicklermodus)
2. Rechtsklick auf deinen Server
3. "ID kopieren"

## Installation & Start:
```bash
# Dependencies installieren
npm install

# Server starten
npm start
```

## Wichtige Hinweise:
- Der Bot muss **vor** den Benutzern auf dem Server sein
- Der Bot braucht die Berechtigung, Mitglieder hinzuzufügen
- Access Tokens laufen nach einer Weile ab (normalerweise 7 Tage)
- Für Produktion solltest du Token-Refresh implementieren

## Fehlerbehebung:
- **"Missing Access"**: Bot hat keine Berechtigung → Prüfe Bot-Permissions
- **"Unknown Guild"**: Falsche Server-ID → Prüfe DISCORD_GUILD_ID
- **"Invalid Token"**: Bot Token falsch → Generiere neuen Token
- **User wird nicht hinzugefügt**: SERVER MEMBERS INTENT nicht aktiviert

## Sicherheitshinweise:
- Teile niemals deine Tokens öffentlich
- Nutze HTTPS in Produktion
- Implementiere Rate Limiting für die Auth-Routes
- Speichere Refresh Tokens sicher (z.B. verschlüsselt in einer Datenbank)
