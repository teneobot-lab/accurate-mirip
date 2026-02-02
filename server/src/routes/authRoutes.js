
const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// Simple Login Stub for Demo
router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        // In prod: Hash check
        const [users] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        
        if (users.length === 0 || users[0].password_hash !== password) {
             // Fallback for default admin if DB empty
             if (username === 'admin' && password === '22') {
                 return res.json({ token: 'mock-jwt-token', user: { id: 'admin', name: 'Super Admin', role: 'ADMIN' }});
             }
             return res.status(401).json({ message: 'Invalid credentials' });
        }
        
        const user = users[0];
        res.json({ 
            token: 'mock-jwt-token-' + user.id, 
            user: { id: user.id, name: user.full_name, role: user.role }
        });
    } catch (e) {
        next(e);
    }
});

module.exports = router;
