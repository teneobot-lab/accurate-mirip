
import React, { useState, useEffect } from 'react';
import { Music, Plus, Play, Trash2, ListMusic, X, SkipForward, SkipBack, Edit3, Loader2, Youtube, Pause } from 'lucide-react';
import { StorageService } from '../services/storage';
import { Playlist } from '../types';
import { useToast } from './Toast';

const MusicPlayer: React.FC = () => {
  const { showToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isManaging, setIsManaging] = useState(false);
  
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongUrl, setNewSongUrl] = useState('');

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

  useEffect(() => { loadData(); }, []);

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);
  const currentSong = activePlaylist?.songs[currentSongIndex];

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

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1.5 rounded-lg border transition-all flex items-center gap-2 ${
          currentSong 
          ? 'bg-blue-50 text-blue-700 border-blue-200 pr-3' 
          : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
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

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-1 duration-200 origin-top-right">
          <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex justify-between items-center">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Youtube size={12}/> Audio System
            </h4>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-rose-500"><X size={14}/></button>
          </div>

          <div className="p-3">
            {currentSong && (
              <div className="mb-4 bg-slate-900 rounded-lg overflow-hidden aspect-video relative group">
                {videoId && (
                  <iframe 
                    key={videoId} width="100%" height="100%" 
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&modestbranding=1&rel=0&playsinline=1`}
                    title="Player" frameBorder="0" allow="autoplay; encrypted-media" className="absolute inset-0"
                  ></iframe>
                )}
                {!videoId && <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-[10px]">Invalid Source</div>}
              </div>
            )}

            <div className="flex border-b border-slate-100 mb-3">
              <button onClick={() => setIsManaging(false)} className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-tight ${!isManaging ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>List</button>
              <button onClick={() => setIsManaging(true)} className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-tight ${isManaging ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>Manage</button>
            </div>

            <div className="max-h-56 overflow-y-auto custom-scrollbar">
              {isManaging ? (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    <input type="text" placeholder="New Playlist..." value={newPlaylistName} onChange={e=>setNewPlaylistName(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] outline-none" />
                    <button onClick={handleCreatePlaylist} className="p-1 bg-blue-600 text-white rounded"><Plus size={14}/></button>
                  </div>
                  {playlists.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border border-slate-100">
                      <span className="text-[11px] font-semibold text-slate-700">{p.name}</span>
                      <button onClick={() => StorageService.deletePlaylist(p.id).then(loadData)} className="text-slate-400 hover:text-rose-500"><Trash2 size={12}/></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {playlists.map(p => (
                    <button 
                      key={p.id} onClick={() => { setActivePlaylistId(p.id); setCurrentSongIndex(0); }}
                      className={`w-full text-left p-2 rounded transition-colors text-[11px] font-medium flex justify-between items-center ${activePlaylistId === p.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-[9px] opacity-50">{p.songs.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicPlayer;
