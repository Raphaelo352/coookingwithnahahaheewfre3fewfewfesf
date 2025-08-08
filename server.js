// Benötigte Module importieren
require('dotenv').config(); // Lädt Umgebungsvariablen aus der .env-Datei
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const os = require('os'); // Für IP-Adresse ermitteln

// Express-Anwendung initialisieren
const app = express();
const PORT = 3000;

// Funktion um die lokale IPv4-Adresse zu ermitteln
function getLocalIPv4() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            if (interface.family === 'IPv4' && !interface.internal) {
                return interface.address;
            }
        }
    }
    return 'localhost';
}

const LOCAL_IP = getLocalIPv4();

// Session Middleware einrichten
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));

// Template-Engine EJS einrichten
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body Parser Middleware für POST-Requests
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Statische Dateien aus dem "public"-Ordner bereitstellen (für CSS)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware: Prüft bei jedem Request, ob der eingeloggte Benutzer noch auf dem Server ist
app.use(async (req, res, next) => {
    if (req.session.user && req.session.user.accessToken) {
        try {
            // Versuche den Benutzer wieder zum Server hinzuzufügen (falls er nicht mehr da ist)
            const response = await axios.put(
                `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${req.session.user.id}`,
                {
                    access_token: req.session.user.accessToken,
                },
                {
                    headers: {
                        'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            // Status 201 = Benutzer wurde hinzugefügt, 204 = Benutzer war bereits da
            if (response.status === 201) {
                console.log(`🔄 Benutzer ${req.session.user.username} wurde automatisch wieder zum Server hinzugefügt`);
            }
        } catch (error) {
            // Ignoriere Fehler hier, da sie die normale Funktionalität nicht beeinträchtigen sollen
            if (error.response && error.response.status !== 204) {
                console.error('Fehler beim Auto-Rejoin:', error.response?.data || error.message);
            }
        }
    }
    next();
});

// Definiert Routen

// Route für Kauf von Donut Skeleton Spawner
app.get('/product/donut-skeleton-spawner', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/auth/discord');
    }
    res.render('donut-skeleton-spawner', { user: req.session.user });
});

// Zahlung initiieren - Weiterleitung zum Stripe Payment Link
app.post('/create-checkout-session', async (req, res) => {
    const { minecraftUsername } = req.body;
    if (!req.session.user) {
        return res.redirect('/auth/discord');
    }
    
    // Speichere die Bestelldetails in der Session für später
    req.session.pendingOrder = {
        minecraftUsername: minecraftUsername,
        discordId: req.session.user.id,
        discordUsername: req.session.user.username,
        productName: 'Donut Skeleton Spawner'
    };
    
    // Erstelle die Stripe Payment Link URL mit Pre-fill Daten
    const stripePaymentUrl = `https://buy.stripe.com/aFadR9gRL3yf9gA8DV0RG00?prefilled_email=${encodeURIComponent(req.session.user.username + '@discord.user')}&client_reference_id=${req.session.user.id}_${minecraftUsername}`;
    
    res.json({ url: stripePaymentUrl });
});

// Erfolgreiche Zahlung
app.get('/success', (req, res) => {
    res.render('success');
});

// Abgebrochene Zahlung
app.get('/cancel', (req, res) => {
    res.render('cancel');
});

// 1. Hauptroute: Zeigt die Shop-Seite an
app.get('/', (req, res) => {
    // Übergibt die User-Daten aus der Session an die EJS-Vorlage
    res.render('index', { user: req.session.user });
});

// 2. Login-Route: Leitet den Nutzer zu Discord weiter
app.get('/auth/discord', (req, res) => {
    // Erweiterte Scopes: identify + guilds.join für Server-Beitritt
    const authorizationUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(`http://localhost:${PORT}/auth/discord/callback`)}&response_type=code&scope=identify%20guilds.join`;
    res.redirect(authorizationUrl);
});

// 3. Callback-Route: Wird von Discord nach der Autorisierung aufgerufen
app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('Fehler: Kein Autorisierungscode von Discord erhalten.');
    }

    try {
        // Tausche den Code gegen einen Access Token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `http://localhost:${PORT}/auth/discord/callback`
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;
        const refreshToken = tokenResponse.data.refresh_token;

        // Nutze den Access Token, um die Nutzerdaten von Discord abzurufen
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        // Speichere die relevanten Nutzerdaten in der Session
        req.session.user = {
            id: userResponse.data.id,
            username: userResponse.data.username,
            avatar: userResponse.data.avatar,
            accessToken: accessToken,
            refreshToken: refreshToken
        };

        // Füge den Benutzer automatisch zum Discord-Server hinzu
        try {
            await axios.put(
                `https://discord.com/api/guilds/${process.env.DISCORD_GUILD_ID}/members/${userResponse.data.id}`,
                {
                    access_token: accessToken,
                },
                {
                    headers: {
                        'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            console.log(`✅ Benutzer ${userResponse.data.username} wurde dem Server hinzugefügt`);
        } catch (joinError) {
            // Fehler 204 bedeutet, dass der Benutzer bereits auf dem Server ist
            if (joinError.response && joinError.response.status === 204) {
                console.log(`ℹ️ Benutzer ${userResponse.data.username} ist bereits auf dem Server`);
            } else {
                console.error('Fehler beim Hinzufügen zum Server:', joinError.response?.data || joinError.message);
            }
        }

        // Leite den Nutzer zurück zur Startseite
        res.redirect('/');

    } catch (error) {
        console.error('Fehler bei der Discord-Authentifizierung:', error);
        res.status(500).send('Login fehlgeschlagen.');
    }
});

// 4. Logout-Route: Zerstört die Session
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); // Cookie löschen
        res.redirect('/');
    });
});

// Server starten - auf allen Netzwerk-Interfaces lauschen
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server läuft auf:`);
    console.log(`   Lokal: http://localhost:${PORT}`);
    console.log(`   Netzwerk: http://${LOCAL_IP}:${PORT}`);
    console.log(`   Alle Interfaces: http://0.0.0.0:${PORT}`);
});