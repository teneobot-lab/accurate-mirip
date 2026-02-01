
import React, { useState } from 'react';
import { User, Lock, Loader2 } from 'lucide-react';
import { StorageService } from '../services/storage';

interface Props {
    onLogin: (user: any) => void;
}

export const LoginPage: React.FC<Props> = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        // Simulate network delay for effect
        setTimeout(() => {
            const users = StorageService.getUsers();
            
            // Check Storage for custom users
            // Note: In a real app, never store plain text passwords. This is for client-side demo only.
            const user = users.find(u => u.username === username && u.password === password && u.status === 'ACTIVE');
            
            // Logic: Superadmin (admin/22) OR Stored User
            if (
                (username === 'admin' && password === '22') || 
                user
            ) {
                onLogin({ 
                    name: user ? user.name : 'Super Admin', 
                    username: username, 
                    role: user ? user.role : 'ADMIN' 
                });
            } else {
                setError('Invalid username or password.');
                setIsLoading(false);
            }
        }, 1000);
    };

    return (
        <div className="min-h-screen w-full bg-[#021017] flex items-center justify-center relative overflow-hidden font-sans">
            
            {/* Background Geometric Shape (Diagonal Overlay) */}
            <div className="absolute top-0 bottom-0 right-0 w-[60%] bg-[#062029] -skew-x-12 translate-x-1/4 z-0 origin-bottom"></div>
            
            <div className="relative z-10 w-full max-w-sm px-8 flex flex-col items-center">
                
                <h1 className="text-4xl font-bold text-white mb-12 uppercase tracking-wide drop-shadow-md">User Login</h1>

                <form onSubmit={handleLogin} className="w-full flex flex-col gap-6">
                    
                    {/* Username Input - White Circle LEFT */}
                    <div className="relative w-full group">
                        <div className="absolute left-0 top-0 bottom-0 w-12 h-12 bg-white rounded-full flex items-center justify-center z-10 shadow-[2px_0_10px_rgba(0,0,0,0.2)]">
                            <User size={24} className="text-[#021017]" strokeWidth={2.5} />
                        </div>
                        <input 
                            type="text" 
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full h-12 bg-[#ffffff15] rounded-full pl-16 pr-6 text-white placeholder:text-white/40 outline-none focus:bg-[#ffffff25] transition-all border border-transparent focus:border-white/10 shadow-inner"
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
                            className="w-full h-12 bg-[#ffffff15] rounded-full pl-6 pr-16 text-white placeholder:text-white/40 outline-none focus:bg-[#ffffff25] transition-all border border-transparent focus:border-white/10 shadow-inner"
                            required
                        />
                         <div className="absolute right-0 top-0 bottom-0 w-12 h-12 bg-white rounded-full flex items-center justify-center z-10 shadow-[-2px_0_10px_rgba(0,0,0,0.2)]">
                            <Lock size={24} className="text-[#021017]" strokeWidth={2.5} />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-400 text-xs text-center font-bold tracking-wide animate-pulse bg-red-900/20 py-1 rounded">
                            {error}
                        </div>
                    )}

                    {/* Login Button */}
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="mt-6 w-full h-14 bg-white rounded-full text-[#021017] text-xl font-bold uppercase tracking-wider hover:bg-slate-200 transition-all shadow-[0_4px_14px_rgba(0,0,0,0.4)] active:scale-[0.98] flex items-center justify-center"
                    >
                        {isLoading ? <Loader2 size={24} className="animate-spin text-[#021017]" /> : 'LOGIN'}
                    </button>

                </form>
            </div>
        </div>
    );
};
