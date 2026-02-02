
import React, { useState } from 'react';
import { User, Lock, Loader2, AlertCircle } from 'lucide-react';
import { StorageService, API_URL } from '../services/storage';

interface Props {
    onLogin: (user: any) => void;
}

export const LoginPage: React.FC<Props> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;

        setError('');
        setIsLoading(true);

        // Tambahkan AbortController untuk handle timeout (10 detik)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Cek jika response bukan JSON (misal HTML error page dari proxy)
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Server tidak memberikan respon valid (Non-JSON).");
            }

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                onLogin(result.user);
            } else {
                setError(result.message || 'Username atau password salah.');
            }
        } catch (err: any) {
            clearTimeout(timeoutId);
            console.error('Login error:', err);
            
            if (err.name === 'AbortError') {
                setError('Koneksi timeout. Server tidak merespon (Backend Down?).');
            } else if (err.message.includes('Failed to fetch')) {
                setError('Gagal terhubung ke server. Periksa koneksi internet atau status Backend.');
            } else {
                setError(err.message || 'Terjadi kesalahan sistem saat login.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-[#021017] flex items-center justify-center relative overflow-hidden font-sans">
            
            {/* Background Geometric Shape (Diagonal Overlay) */}
            <div className="absolute top-0 bottom-0 right-0 w-[60%] bg-[#062029] -skew-x-12 translate-x-1/4 z-0 origin-bottom"></div>
            
            <div className="relative z-10 w-full max-w-sm px-8 flex flex-col items-center">
                
                <h1 className="text-4xl font-black text-white mb-12 uppercase tracking-tight drop-shadow-2xl">User Login</h1>

                <form onSubmit={handleLogin} className="w-full flex flex-col gap-6">
                    
                    {/* Username Input */}
                    <div className="relative w-full group">
                        <div className="absolute left-0 top-0 bottom-0 w-12 h-12 bg-white rounded-full flex items-center justify-center z-10 shadow-[4px_0_15px_rgba(0,0,0,0.3)] group-focus-within:scale-110 transition-transform">
                            <User size={22} className="text-[#021017]" strokeWidth={2.5} />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full h-12 bg-white/10 rounded-full pl-16 pr-6 text-white placeholder:text-white/30 outline-none focus:bg-white/20 transition-all border border-white/5 focus:border-white/20 shadow-inner text-sm font-medium"
                            required
                            autoComplete="username"
                        />
                    </div>

                    {/* Password Input */}
                    <div className="relative w-full group">
                        <input 
                            type="password" 
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-12 bg-white/10 rounded-full pl-6 pr-16 text-white placeholder:text-white/30 outline-none focus:bg-white/20 transition-all border border-white/5 focus:border-white/20 shadow-inner text-sm font-medium"
                            required
                            autoComplete="current-password"
                        />
                         <div className="absolute right-0 top-0 bottom-0 w-12 h-12 bg-white rounded-full flex items-center justify-center z-10 shadow-[-4px_0_15px_rgba(0,0,0,0.3)] group-focus-within:scale-110 transition-transform">
                            <Lock size={22} className="text-[#021017]" strokeWidth={2.5} />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-400 text-[11px] text-center font-bold tracking-wide animate-in fade-in slide-in-from-top-1 bg-red-500/10 border border-red-500/20 py-2 px-4 rounded-xl flex items-center gap-2 justify-center">
                            <AlertCircle size={14} />
                            {error}
                        </div>
                    )}

                    {/* Login Button */}
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="mt-4 w-full h-14 bg-white rounded-full text-[#021017] text-lg font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)] active:scale-[0.96] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {isLoading ? (
                            <Loader2 size={24} className="animate-spin text-[#021017]" />
                        ) : (
                            <span className="flex items-center gap-2">
                                MASUK 
                            </span>
                        )}
                    </button>

                </form>

                <div className="mt-12 text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">
                    GudangPro v2.0 Enterprise
                </div>
            </div>
        </div>
    );
};
