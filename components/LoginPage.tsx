
import React, { useState } from 'react';
import { User, Lock, Loader2 } from 'lucide-react';
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
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                onLogin(result.user);
            } else {
                setError(result.message || 'Invalid username or password.');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('Could not connect to the server. Please check your connection.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center relative overflow-hidden font-sans">
            
            {/* Background Geometric Shape (Diagonal Overlay) */}
            <div className="absolute top-0 bottom-0 right-0 w-[60%] bg-slate-800/30 -skew-x-12 translate-x-1/4 z-0 origin-bottom border-l border-white/5"></div>
            
            <div className="relative z-10 w-full max-w-sm px-8 flex flex-col items-center">
                
                <div className="w-16 h-16 flex items-center justify-center bg-white rounded-2xl mb-6 shadow-lg">
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10">
                        <circle cx="50" cy="50" r="40" stroke="#0f172a" strokeWidth="12"/>
                        <path d="M50 30V70M30 50H70" stroke="#0f172a" strokeWidth="12"/>
                    </svg>
                </div>
                
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Welcome Back</h1>
                <p className="text-slate-400 text-sm mb-10">Sign in to GudangPro Inventory</p>

                <form onSubmit={handleLogin} className="w-full flex flex-col gap-5">
                    
                    {/* Username Input - White Circle LEFT */}
                    <div className="relative w-full group">
                        <div className="absolute left-0 top-0 bottom-0 w-12 h-12 bg-white rounded-full flex items-center justify-center z-10 shadow-md">
                            <User size={20} className="text-slate-800" strokeWidth={2.5} />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full h-12 bg-white/10 rounded-full pl-16 pr-6 text-white placeholder:text-slate-400 outline-none focus:bg-white/20 transition-all border border-transparent focus:border-slate-500 shadow-inner"
                            required
                        />
                    </div>

                    {/* Password Input - White Circle RIGHT */}
                    <div className="relative w-full group">
                        <input 
                            type="password" 
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-12 bg-white/10 rounded-full pl-6 pr-16 text-white placeholder:text-slate-400 outline-none focus:bg-white/20 transition-all border border-transparent focus:border-slate-500 shadow-inner"
                            required
                        />
                         <div className="absolute right-0 top-0 bottom-0 w-12 h-12 bg-white rounded-full flex items-center justify-center z-10 shadow-md">
                            <Lock size={20} className="text-slate-800" strokeWidth={2.5} />
                        </div>
                    </div>

                    {error && (
                        <div className="text-rose-200 text-xs text-center font-medium bg-rose-900/50 py-2.5 rounded-lg border border-rose-500/30">
                            {error}
                        </div>
                    )}

                    {/* Login Button */}
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="mt-4 w-full h-12 bg-brand hover:bg-sky-600 text-white rounded-full text-sm font-bold uppercase tracking-wider transition-all shadow-lg active:scale-[0.98] flex items-center justify-center border border-white/10"
                    >
                        {isLoading ? <Loader2 size={20} className="animate-spin text-white" /> : 'Sign In'}
                    </button>

                </form>
            </div>
        </div>
    );
};
