
const router = require('express').Router();
const musicController = require('../controllers/musicController');

router.get('/playlists', musicController.getPlaylists);
router.post('/playlists', musicController.createPlaylist);
router.post('/playlists/:playlistId/songs', musicController.addSong);
router.delete('/playlists/:id', musicController.deletePlaylist);
router.delete('/songs/:id', musicController.deleteSong);

module.exports = router;
