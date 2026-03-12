
import React, { useState, useEffect } from 'react';
import { Music, Plus, Play, Trash2, ListMusic, X, SkipForward, SkipBack, Edit3, Loader2, Youtube, Pause, Square } from 'lucide-react';
import { StorageService } from '../services/storage';
import { Playlist } from '../types';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';

const MusicPlayer: React.FC = () => {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isManaging, setIsManaging] = useState(false);
  
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongUrl, setNewSongUrl] = useState('');
  
  const [playlistToDelete, setPlaylistToDelete] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await StorageService.fetchPlaylists();
      setPlaylists(data);
    } catch (e) {
      console.error("Music Sync Error", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { 
    loadData(); 
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-music-player', handleOpen);
    return () => window.removeEventListener('open-music-player', handleOpen);
  }, []);

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);
  const currentSong = activePlaylist?.songs[currentSongIndex];
  const editingPlaylist = playlists.find(p => p.id === editingPlaylistId);

  const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const videoId = currentSong ? getYoutubeId(currentSong.youtubeUrl) : null;

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await StorageService.createPlaylist(newPlaylistName);
      setNewPlaylistName('');
      showToast("Playlist dibuat", "success");
      loadData();
    } catch (e) { showToast("Gagal buat playlist", "error"); }
  };

  const handleDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    try {
      await StorageService.deletePlaylist(playlistToDelete);
      showToast("Playlist dihapus", "success");
      if (activePlaylistId === playlistToDelete) {
        setActivePlaylistId(null);
      }
      if (editingPlaylistId === playlistToDelete) {
        setEditingPlaylistId(null);
      }
      loadData();
    } catch (e) {
      showToast("Gagal menghapus playlist", "error");
    } finally {
      setPlaylistToDelete(null);
    }
  };

  const handleAddSong = async () => {
    if (!editingPlaylistId || !newSongTitle.trim() || !newSongUrl.trim()) return;
    try {
      await StorageService.addSongToPlaylist(editingPlaylistId, newSongTitle, newSongUrl);
      setNewSongTitle('');
      setNewSongUrl('');
      showToast("Lagu ditambahkan", "success");
      loadData();
    } catch (e) {
      showToast("Gagal menambahkan lagu", "error");
    }
  };

  const handleDeleteSong = async (songId: string) => {
    try {
      await StorageService.deleteSong(songId);
      showToast("Lagu dihapus", "success");
      loadData();
    } catch (e) {
      showToast("Gagal menghapus lagu", "error");
    }
  };

  const handleStop = () => {
    setActivePlaylistId(null);
    setCurrentSongIndex(0);
  };

  const handleNext = () => {
    if (activePlaylist && currentSongIndex < activePlaylist.songs.length - 1) {
      setCurrentSongIndex(prev => prev + 1);
    } else {
      setCurrentSongIndex(0);
    }
  };

  const handlePrev = () => {
    if (activePlaylist && currentSongIndex > 0) {
      setCurrentSongIndex(prev => prev - 1);
    }
  };

  return (
    <div className="relative">
      {/* BUTTON: Only show if playing OR if dropdown is open */}
      {(currentSong || isOpen) && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`p-1.5 rounded-lg border transition-all flex items-center gap-2 ${
            currentSong 
            ? 'bg-brand/10 text-brand border-brand/20 pr-3' 
            : 'bg-mist-50/50 text-slate-400 border-mist-300 hover:border-mist-400'
          }`}
        >
          <Music size={18} className={currentSong ? 'animate-pulse' : ''} />
          {currentSong && (
            <div className="flex flex-col text-left overflow-hidden max-w-[120px]">
              <span className="text-[10px] font-bold truncate leading-tight">{currentSong.title}</span>
              <span className="text-[8px] opacity-70 uppercase font-bold tracking-tighter">Playing...</span>
            </div>
          )}
        </button>
      )}

      {/* DROPDOWN: Always rendered to keep iframe alive, hidden via CSS */}
      <div className={`absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 origin-top-right transition-all duration-200 ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
        <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
            <Youtube size={12}/> Audio System
          </h4>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={14}/></button>
        </div>

        <div className="p-3">
          {currentSong && (
            <div className="mb-3">
              <div className="bg-slate-900 rounded-lg overflow-hidden aspect-video relative group mb-2">
                {videoId && (
                  <iframe 
                    key={videoId} width="100%" height="100%" 
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1&rel=0&playsinline=1`}
                    title="Player" frameBorder="0" allow="autoplay; encrypted-media" className="absolute inset-0"
                  ></iframe>
                )}
                {!videoId && <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-[10px]">Invalid Source</div>}
              </div>
              
              <div className="flex items-center justify-between bg-slate-50 rounded border border-slate-100 p-1.5">
                <button onClick={handlePrev} className="p-1.5 text-slate-500 hover:text-brand hover:bg-brand/10 rounded"><SkipBack size={14}/></button>
                <button onClick={handleStop} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded flex items-center gap-1 text-[10px] font-bold"><Square size={12}/> STOP</button>
                <button onClick={handleNext} className="p-1.5 text-slate-500 hover:text-brand hover:bg-brand/10 rounded"><SkipForward size={14}/></button>
              </div>
            </div>
          )}

          <div className="flex border-b border-slate-100 mb-3">
            <button onClick={() => setIsManaging(false)} className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-tight ${!isManaging ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>List</button>
            <button onClick={() => setIsManaging(true)} className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-tight ${isManaging ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Manage</button>
          </div>

          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            {isManaging ? (
              editingPlaylistId ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => setEditingPlaylistId(null)} className="text-slate-400 hover:text-slate-600"><SkipBack size={14} /></button>
                    <span className="text-[11px] font-bold text-slate-700">{editingPlaylist?.name}</span>
                  </div>
                  <div className="flex flex-col gap-1.5 mb-3 bg-slate-50 p-2 rounded border border-slate-200">
                    <input type="text" placeholder="Judul Lagu..." value={newSongTitle} onChange={e=>setNewSongTitle(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-[11px] outline-none" />
                    <div className="flex gap-1.5">
                      <input type="text" placeholder="URL Youtube..." value={newSongUrl} onChange={e=>setNewSongUrl(e.target.value)} className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-[11px] outline-none" />
                      <button onClick={handleAddSong} className="px-2 bg-blue-600 text-white rounded text-[10px] font-bold">Add</button>
                    </div>
                  </div>
                  {editingPlaylist?.songs.map(song => (
                    <div key={song.id} className="flex justify-between items-center p-1.5 bg-slate-50 rounded border border-slate-100">
                      <span className="text-[10px] font-medium text-slate-600 truncate flex-1 pr-2">{song.title}</span>
                      <button onClick={() => handleDeleteSong(song.id)} className="text-slate-400 hover:text-rose-500"><Trash2 size={12}/></button>
                    </div>
                  ))}
                  {(!editingPlaylist?.songs || editingPlaylist.songs.length === 0) && (
                    <div className="text-center text-[10px] text-slate-400 py-2">Belum ada lagu</div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <input type="text" placeholder="New Playlist..." value={newPlaylistName} onChange={e=>setNewPlaylistName(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] outline-none" />
                    <button onClick={handleCreatePlaylist} className="p-1 bg-blue-600 text-white rounded"><Plus size={14}/></button>
                  </div>
                  {playlists.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                      <span className="text-[11px] font-semibold text-slate-700 flex-1 truncate">{p.name}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingPlaylistId(p.id)} className="p-1 text-slate-400 hover:text-blue-600"><Edit3 size={12}/></button>
                        <button onClick={() => setPlaylistToDelete(p.id)} className="p-1 text-slate-400 hover:text-rose-500"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-1">
                {playlists.map(p => (
                  <button 
                    key={p.id} onClick={() => { setActivePlaylistId(p.id); setCurrentSongIndex(0); }}
                    className={`w-full text-left p-2 rounded transition-colors text-[11px] font-medium flex justify-between items-center ${activePlaylistId === p.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-[9px] opacity-50">{p.songs.length} lagu</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!playlistToDelete}
        title="Hapus Playlist"
        message="Apakah Anda yakin ingin menghapus playlist ini?"
        onConfirm={handleDeletePlaylist}
        onCancel={() => setPlaylistToDelete(null)}
      />
    </div>
  );
};

export default MusicPlayer;
