import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {api,unwrap,message} from '../api';
const Context=createContext(null);
export function AuthProvider({children}){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[authError,setAuthError]=useState('');
 useEffect(()=>{let alive=true;const token=localStorage.getItem('erp.accessToken');if(!token){setLoading(false);return()=>{alive=false;};}
 api.get('/auth/me').then(r=>{if(alive)setUser(unwrap(r).user||unwrap(r));}).catch(e=>{localStorage.removeItem('erp.accessToken');if(alive&&e.response?.status!==401)setAuthError(message(e));}).finally(()=>{if(alive)setLoading(false);});
 const unauth=()=>{localStorage.removeItem('erp.accessToken');setUser(null);};window.addEventListener('erp:unauthorized',unauth);return()=>{alive=false;window.removeEventListener('erp:unauthorized',unauth);};},[]);
 const value=useMemo(()=>({user,loading,authError,async login(email,password){const r=unwrap(await api.post('/auth/login',{email,password}));localStorage.setItem('erp.accessToken',r.accessToken);setUser(r.user);return r.user;},async logout(){try{if(user)await api.post('/auth/logout');}finally{localStorage.removeItem('erp.accessToken');setUser(null);}},async refresh(){const r=unwrap(await api.get('/auth/me'));setUser(r.user||r);}}),[user,loading,authError]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAuth=()=>{const c=useContext(Context);if(!c)throw new Error('useAuth must be inside AuthProvider');return c;};
