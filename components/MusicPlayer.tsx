
import React, { useState, useEffect } from 'react';
import { Music, Plus, Play, Trash2, ListMusic, X, SkipForward, SkipBack, Edit3, Loader2, Youtube } from 'lucide-react';
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
      console.error("Music DB Sync Error", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);
  const currentSong = activePlaylist?.songs[currentSongIndex];

  // UPDATED: Robust Regex untuk menangkap ID dari link biasa, share, shorts, mobile, dll.
  const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/;
    const match = url.match(regExp);
    return match ? match[1] : null;
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await StorageService.createPlaylist(newPlaylistName);
      setNewPlaylistName('');
      showToast("Playlist tersimpan di MySQL", "success");
      loadData();
    } catch (e) {
      showToast("Gagal simpan playlist", "error");
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Hapus playlist ini secara permanen dari Database?')) return;
    try {
      await StorageService.deletePlaylist(id);
      if (activePlaylistId === id) setActivePlaylistId(null);
      showToast("Playlist dihapus", "info");
      loadData();
    } catch (e) {
      showToast("Gagal hapus", "error");
    }
  };

  const handleAddSong = async (playlistId: string) => {
    if (!newSongTitle.trim() || !newSongUrl.trim()) return;
    const ytId = getYoutubeId(newSongUrl);
    if (!ytId) return showToast('Link YouTube tidak dikenali (Gunakan link Share/Browser)', 'error');

    try {
      await StorageService.addSongToPlaylist(playlistId, newSongTitle, newSongUrl);
      setNewSongTitle('');
      setNewSongUrl('');
      showToast("Lagu ditambahkan ke MySQL", "success");
      loadData();
      const updated = await StorageService.fetchPlaylists();
      setEditingPlaylist(updated.find(p => p.id === playlistId) || null);
    } catch (e) {
      showToast("Gagal tambah lagu", "error");
    }
  };

  const handleDeleteSong = async (pId: string, sId: string) => {
    try {
      await StorageService.deleteSong(sId);
      loadData();
      const updated = await StorageService.fetchPlaylists();
      setEditingPlaylist(updated.find(p => p.id === pId) || null);
    } catch (e) {
      showToast("Gagal hapus lagu", "error");
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all shadow-sm ${
          isOpen ? 'bg-spectra text-white border-spectra' : 'bg-gable text-slate-400 border-spectra hover:bg-spectra/20'
        }`}
      >
        <Music size={18} />
        {!isOpen && currentSong && activePlaylistId && (
            <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-spectra opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
        )}
        <span className="text-xs font-bold hidden sm:inline">Music Player</span>
      </button>

      <div 
        className={`absolute right-0 mt-3 w-80 bg-gable rounded-2xl shadow-2xl border border-spectra overflow-hidden z-50 transition-all duration-200 ease-in-out origin-top-right ${
          isOpen 
            ? 'opacity-100 scale-100 translate-y-0 visible pointer-events-auto' 
            : 'opacity-0 scale-95 -translate-y-2 invisible pointer-events-none'
        }`}
      >
          {currentSong && (
            <div className="p-3 bg-daintree text-white flex flex-col gap-2 border-b border-spectra">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="animate-pulse bg-spectra/50 p-1 rounded-full"><Youtube size={12}/></div>
                  <div className="truncate text-xs font-bold max-w-[200px]">{currentSong.title}</div>
                </div>
                <button onClick={() => setActivePlaylistId(null)} className="text-slate-400 hover:text-white"><X size={14}/></button>
              </div>
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black shadow-inner border border-spectra/30 relative group">
                {getYoutubeId(currentSong.youtubeUrl) ? (
                    <iframe 
                      width="100%" 
                      height="100%" 
                      src={`https://www.youtube.com/embed/${getYoutubeId(currentSong.youtubeUrl)}?autoplay=1&controls=1&modestbranding=1&rel=0&origin=${window.location.origin}`}
                      title="YouTube player" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                      allowFullScreen
                      className="absolute inset-0"
                    ></iframe>
                ) : (
                    <div className="flex items-center justify-center h-full text-xs text-red-400">Invalid YouTube ID</div>
                )}
              </div>
              <div className="flex justify-center items-center gap-4 py-1">
                <button 
                   onClick={() => setCurrentSongIndex(prev => (prev - 1 + activePlaylist!.songs.length) % activePlaylist!.songs.length)}
                   className="hover:scale-110 transition-transform text-slate-300 hover:text-white"
                ><SkipBack size={18}/></button>
                <div className="text-[10px] font-mono text-spectra">
                    {currentSongIndex + 1} / {activePlaylist!.songs.length}
                </div>
                <button 
                  onClick={() => setCurrentSongIndex(prev => (prev + 1) % activePlaylist!.songs.length)}
                  className="hover:scale-110 transition-transform text-slate-300 hover:text-white"
                ><SkipForward size={18}/></button>
              </div>
            </div>
          )}

          <div className="flex border-b border-spectra bg-daintree">
            <button 
              onClick={() => { setIsManaging(false); setEditingPlaylist(null); }}
              className={`flex-1 p-3 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${!isManaging ? 'text-white border-b-2 border-spectra bg-spectra/10' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <ListMusic size={14}/> Playlists
            </button>
            <button 
              onClick={() => setIsManaging(true)}
              className={`flex-1 p-3 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${isManaging ? 'text-white border-b-2 border-spectra bg-spectra/10' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Edit3 size={14}/> Manage
            </button>
          </div>

          <div className="p-4 max-h-96 overflow-y-auto bg-gable min-h-[200px] scrollbar-thin">
            {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-cutty py-10">
                    <Loader2 size={24} className="animate-spin mb-2 text-spectra" />
                    <span className="text-[10px] font-bold">MYSQL SYNC...</span>
                </div>
            ) : isManaging ? (
              <div className="space-y-4">
                {editingPlaylist ? (
                  <div className="space-y-3">
                    <button onClick={() => setEditingPlaylist(null)} className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mb-2 hover:text-white">
                       <SkipBack size={10}/> Back to List
                    </button>
                    <div className="p-3 bg-daintree rounded-lg border border-spectra">
                        <h4 className="text-xs font-bold text-white mb-2">Add Song to {editingPlaylist.name}</h4>
                        <input 
                          type="text" placeholder="Song Title" 
                          value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)}
                          className="w-full text-xs p-2 border border-spectra rounded mb-2 bg-gable text-white outline-none focus:ring-1 focus:ring-spectra placeholder:text-cutty" 
                        />
                        <input 
                          type="text" placeholder="Paste YouTube Link Here..." 
                          value={newSongUrl} onChange={e => setNewSongUrl(e.target.value)}
                          className="w-full text-xs p-2 border border-spectra rounded mb-3 bg-gable text-white outline-none focus:ring-1 focus:ring-spectra placeholder:text-cutty" 
                        />
                        <button 
                          onClick={() => handleAddSong(editingPlaylist.id)}
                          className="w-full py-2 bg-spectra text-white rounded text-xs font-bold hover:bg-white hover:text-spectra transition-colors shadow-lg"
                        >Add Song</button>
                    </div>
                    <div className="space-y-1">
                      {editingPlaylist.songs.map(s => (
                        <div key={s.id} className="flex justify-between items-center p-2 bg-daintree/50 rounded border border-spectra/50 text-xs group">
                           <span className="truncate flex-1 text-slate-300">{s.title}</span>
                           <button onClick={() => handleDeleteSong(editingPlaylist.id, s.id)} className="text-slate-500 hover:text-red-400 ml-2"><Trash2 size={12}/></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input 
                        type="text" placeholder="New Playlist Name" 
                        value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)}
                        className="flex-1 text-xs p-2 border border-spectra rounded bg-daintree text-white outline-none focus:ring-1 focus:ring-spectra placeholder:text-cutty" 
                      />
                      <button onClick={handleCreatePlaylist} className="p-2 bg-spectra text-white rounded hover:bg-white hover:text-spectra transition-colors"><Plus size={16}/></button>
                    </div>
                    <div className="space-y-2">
                       {playlists.map(p => (
                         <div key={p.id} className="flex justify-between items-center p-3 bg-daintree/30 rounded-xl border border-spectra/30 group hover:border-spectra transition-colors">
                            <div className="flex flex-col">
                               <span className="text-sm font-bold text-slate-200">{p.name}</span>
                               <span className="text-[10px] text-slate-500">{p.songs.length} Songs</span>
                            </div>
                            <div className="flex gap-1">
                               <button onClick={() => setEditingPlaylist(p)} className="p-1.5 text-slate-400 hover:text-white rounded"><Edit3 size={14}/></button>
                               <button onClick={() => handleDeletePlaylist(p.id)} className="p-1.5 text-slate-400 hover:text-red-400 rounded"><Trash2 size={14}/></button>
                            </div>
                         </div>
                       ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {playlists.length === 0 && (
                   <div className="text-center py-8 text-cutty text-xs italic">
                      Tidak ada playlist.<br/>Klik 'Manage' untuk membuat.
                   </div>
                )}
                {playlists.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => {
                      if (p.songs.length > 0) {
                        setActivePlaylistId(p.id);
                        setCurrentSongIndex(0);
                      } else {
                        showToast('Playlist kosong', 'info');
                      }
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center group ${
                      activePlaylistId === p.id 
                      ? 'bg-spectra border-spectra shadow-lg' 
                      : 'bg-daintree/30 border-spectra/30 hover:bg-spectra/20 hover:border-spectra'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${activePlaylistId === p.id ? 'bg-white/20 text-white' : 'bg-daintree text-slate-400 group-hover:text-white'}`}>
                        <Music size={14}/>
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${activePlaylistId === p.id ? 'text-white' : 'text-slate-300'}`}>{p.name}</span>
                        <span className={`text-[10px] ${activePlaylistId === p.id ? 'text-white/60' : 'text-slate-500'}`}>{p.songs.length} Tracks</span>
                      </div>
                    </div>
                    {activePlaylistId === p.id ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></div> : <Play size={14} className="text-slate-500 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-2 bg-daintree border-t border-spectra text-[10px] text-center text-cutty">
             GudangPro Audio v1.1 • MySQL Centralized
          </div>
        </div>
    </div>
  );
};

export default MusicPlayer;
