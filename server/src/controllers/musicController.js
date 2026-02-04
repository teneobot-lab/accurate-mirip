
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

exports.getPlaylists = async (req, res, next) => {
    try {
        const [playlists] = await db.query(`SELECT * FROM playlists ORDER BY created_at DESC`);
        const [songs] = await db.query(`SELECT * FROM playlist_songs ORDER BY added_at ASC`);

        const result = playlists.map(p => ({
            id: p.id,
            name: p.name,
            songs: songs
                .filter(s => s.playlist_id === p.id)
                .map(s => ({
                    id: s.id,
                    title: s.title,
                    youtubeUrl: s.youtube_url, // FIX: Map DB column to Frontend Prop
                    addedAt: s.added_at
                }))
        }));

        res.json(result);
    } catch (error) {
        next(error);
    }
};

exports.createPlaylist = async (req, res, next) => {
    try {
        const { name } = req.body;
        const id = uuidv4();
        await db.query(`INSERT INTO playlists (id, name) VALUES (?, ?)`, [id, name]);
        res.status(201).json({ id, name, songs: [] });
    } catch (error) {
        next(error);
    }
};

exports.addSong = async (req, res, next) => {
    try {
        const { playlistId } = req.params;
        const { title, youtubeUrl } = req.body;
        const id = uuidv4();
        
        await db.query(
            `INSERT INTO playlist_songs (id, playlist_id, title, youtube_url) VALUES (?, ?, ?, ?)`,
            [id, playlistId, title, youtubeUrl]
        );
        res.status(201).json({ id, playlistId, title, youtubeUrl });
    } catch (error) {
        next(error);
    }
};

exports.deletePlaylist = async (req, res, next) => {
    try {
        const { id } = req.params;
        await db.query(`DELETE FROM playlists WHERE id = ?`, [id]);
        res.json({ message: 'Deleted' });
    } catch (error) {
        next(error);
    }
};

exports.deleteSong = async (req, res, next) => {
    try {
        const { id } = req.params;
        await db.query(`DELETE FROM playlist_songs WHERE id = ?`, [id]);
        res.json({ message: 'Deleted' });
    } catch (error) {
        next(error);
    }
};
