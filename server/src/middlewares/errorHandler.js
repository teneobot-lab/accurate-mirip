
module.exports = (err, req, res, next) => {
    console.error(err.stack);

    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({
        status: 'error',
        message: message,
        // Only show stack trace in dev
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};
