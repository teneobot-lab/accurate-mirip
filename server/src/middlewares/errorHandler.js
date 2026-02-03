
module.exports = (err, req, res, next) => {
    // Pastikan error dicetak agar terlihat di PM2 logs
    console.error('--- EXCEPTION DETECTED ---');
    console.error('Time:', new Date().toISOString());
    console.error('Method:', req.method);
    console.error('URL:', req.originalUrl);
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    console.error('---------------------------');

    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({
        status: 'error',
        message: message,
        // Tampilkan stack trace di development atau jika ada error kritis
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};
