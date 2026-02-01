
import React, { useState, useEffect } from 'react';
import { Music, Plus, Play, Trash2, ListMusic, X, SkipForward, SkipBack, Edit3 } from 'lucide-react';
import { StorageService } from '../services/storage';
import { Playlist } from '../types';

const MusicPlayer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [playlists, setPlaylists] = useState<Playlist[]>(StorageService.getPlaylists());
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [currentSongIndex, setCurrentSongIndex] = useState(0);
  const [isManaging, setIsManaging] = useState(false);
  
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [newSongTitle, setNewSongTitle] = useState('');
  const [newSongUrl, setNewSongUrl] = useState('');

  useEffect(() => {
    StorageService.savePlaylists(playlists);
  }, [playlists]);

  const activePlaylist = playlists.find(p => p.id === activePlaylistId);
  const currentSong = activePlaylist?.songs[currentSongIndex];

  const getYoutubeId = (url: string) => {
    try {
        if (!url) return null;
        // Robust regex for YouTube ID
        const regExp = new RegExp(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    } catch (e) {
        return null;
    }
  };

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;
    const newList: Playlist = {
      id: crypto.randomUUID(),
      name: newPlaylistName,
      songs: []
    };
    setPlaylists([...playlists, newList]);
    setNewPlaylistName('');
  };

  const handleDeletePlaylist = (id: string) => {
    if (!confirm('Delete this playlist?')) return;
    setPlaylists(playlists.filter(p => p.id !== id));
    if (activePlaylistId === id) setActivePlaylistId(null);
  };

  const handleAddSong = (playlistId: string) => {
    if (!newSongTitle.trim() || !newSongUrl.trim()) return;
    const ytId = getYoutubeId(newSongUrl);
    if (!ytId) return alert('Invalid YouTube URL');

    const updated = playlists.map(p => {
      if (p.id === playlistId) {
        return {
          ...p,
          songs: [...p.songs, { id: crypto.randomUUID(), title: newSongTitle, youtubeUrl: newSongUrl }]
        };
      }
      return p;
    });
    setPlaylists(updated);
    setEditingPlaylist(updated.find(p => p.id === playlistId) || null);
    setNewSongTitle('');
    setNewSongUrl('');
  };

  const handleDeleteSong = (pId: string, sId: string) => {
    const updated = playlists.map(p => {
      if (p.id === pId) {
        return { ...p, songs: p.songs.filter(s => s.id !== sId) };
      }
      return p;
    });
    setPlaylists(updated);
    setEditingPlaylist(updated.find(p => p.id === pId) || null);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all shadow-sm ${
          isOpen ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
        }`}
      >
        <Music size={18} />
        {/* Indikator Animasi saat bermain tapi ditutup */}
        {!isOpen && currentSong && activePlaylistId && (
            <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
            </span>
        )}
        <span className="text-xs font-bold hidden sm:inline">Music Player</span>
      </button>

      {/* 
        LOGIC CHANGE: 
        Removed the conditional rendering `{isOpen && (...)}` 
        Replaced with CSS classes to handle visibility.
        This keeps the iframe in the DOM so music continues playing.
      */}
      <div 
        className={`absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 transition-all duration-200 ease-in-out origin-top-right ${
          isOpen 
            ? 'opacity-100 scale-100 translate-y-0 visible pointer-events-auto' 
            : 'opacity-0 scale-95 -translate-y-2 invisible pointer-events-none'
        }`}
      >
          {currentSong && (
            <div className="p-3 bg-blue-600 text-white flex flex-col gap-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="animate-pulse bg-white/20 p-1 rounded-full"><Music size={12}/></div>
                  <div className="truncate text-xs font-bold">{currentSong.title}</div>
                </div>
                <button onClick={() => setActivePlaylistId(null)}><X size={14}/></button>
              </div>
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black shadow-inner">
                <iframe 
                  width="100%" 
                  height="100%" 
                  src={`https://www.youtube.com/embed/${getYoutubeId(currentSong.youtubeUrl)}?autoplay=1&controls=1&modestbranding=1`}
                  title="YouTube player" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                ></iframe>
              </div>
              <div className="flex justify-center items-center gap-4 py-1">
                <button 
                   onClick={() => setCurrentSongIndex(prev => (prev - 1 + activePlaylist!.songs.length) % activePlaylist!.songs.length)}
                   className="hover:scale-110 transition-transform"
                ><SkipBack size={18}/></button>
                <button className="bg-white text-blue-600 p-2 rounded-full shadow-lg"><Play size={16}/></button>
                <button 
                  onClick={() => setCurrentSongIndex(prev => (prev + 1) % activePlaylist!.songs.length)}
                  className="hover:scale-110 transition-transform"
                ><SkipForward size={18}/></button>
              </div>
            </div>
          )}

          <div className="flex border-b border-slate-100 dark:border-slate-800">
            <button 
              onClick={() => { setIsManaging(false); setEditingPlaylist(null); }}
              className={`flex-1 p-3 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${!isManaging ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'text-slate-400'}`}
            >
              <ListMusic size={14}/> Playlists
            </button>
            <button 
              onClick={() => setIsManaging(true)}
              className={`flex-1 p-3 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${isManaging ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'text-slate-400'}`}
            >
              <Edit3 size={14}/> Manage
            </button>
          </div>

          <div className="p-4 max-h-96 overflow-y-auto bg-slate-50 dark:bg-slate-900/50">
            {isManaging ? (
              <div className="space-y-4">
                {editingPlaylist ? (
                  <div className="space-y-3">
                    <button onClick={() => setEditingPlaylist(null)} className="text-[10px] text-blue-600 font-bold flex items-center gap-1 mb-2">
                       <SkipBack size={10}/> Back to List
                    </button>
                    <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Add Song to {editingPlaylist.name}</h4>
                        <input 
                          type="text" placeholder="Song Title" 
                          value={newSongTitle} onChange={e => setNewSongTitle(e.target.value)}
                          className="w-full text-xs p-2 border rounded mb-2 dark:bg-slate-900 dark:border-slate-700 outline-none" 
                        />
                        <input 
                          type="text" placeholder="YouTube URL" 
                          value={newSongUrl} onChange={e => setNewSongUrl(e.target.value)}
                          className="w-full text-xs p-2 border rounded mb-3 dark:bg-slate-900 dark:border-slate-700 outline-none" 
                        />
                        <button 
                          onClick={() => handleAddSong(editingPlaylist.id)}
                          className="w-full py-2 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700 transition-colors"
                        >Add Song</button>
                    </div>
                    <div className="space-y-1">
                      {editingPlaylist.songs.map(s => (
                        <div key={s.id} className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 text-xs">
                           <span className="truncate flex-1 dark:text-slate-400">{s.title}</span>
                           <button onClick={() => handleDeleteSong(editingPlaylist.id, s.id)} className="text-red-400 hover:text-red-600 ml-2"><Trash2 size={12}/></button>
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
                        className="flex-1 text-xs p-2 border rounded dark:bg-slate-900 dark:border-slate-700 outline-none" 
                      />
                      <button onClick={handleCreatePlaylist} className="p-2 bg-blue-600 text-white rounded"><Plus size={16}/></button>
                    </div>
                    <div className="space-y-2">
                       {playlists.map(p => (
                         <div key={p.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 group">
                            <div className="flex flex-col">
                               <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{p.name}</span>
                               <span className="text-[10px] text-slate-400">{p.songs.length} Songs</span>
                            </div>
                            <div className="flex gap-1">
                               <button onClick={() => setEditingPlaylist(p)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"><Edit3 size={14}/></button>
                               <button onClick={() => handleDeletePlaylist(p.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
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
                   <div className="text-center py-8 text-slate-400 text-xs italic">
                      No playlists found.<br/>Go to 'Manage' to create one.
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
                        alert('Playlist is empty');
                      }
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center group ${
                      activePlaylistId === p.id 
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${activePlaylistId === p.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:text-blue-500'}`}>
                        <Music size={14}/>
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-sm font-bold ${activePlaylistId === p.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'}`}>{p.name}</span>
                        <span className="text-[10px] text-slate-400">{p.songs.length} Tracks</span>
                      </div>
                    </div>
                    {activePlaylistId === p.id ? <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></div> : <Play size={14} className="text-slate-300 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700 text-[10px] text-center text-slate-400">
             GudangPro Audio v1.0 • Supports YouTube Embeds
          </div>
        </div>
    </div>
  );
};

export default MusicPlayer;
