import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const email = searchParams.get('email');

    if (!token || !email) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    (async () => {
      try {
        const res = await authAPI.verifyEmail({ token, email });
        setStatus('success');
        setMessage(res.data?.message || 'Email verified');
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.message || 'Verification failed');
      }
    })();
  }, [searchParams]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="text-xl font-semibold">Email Verification</div>
        <div className="mt-2 text-sm text-slate-300">
          {status === 'loading' && 'Verifying your email...'}
          {status !== 'loading' && message}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_rgba(139,92,246,0.35)] transition-all duration-300"
            onClick={() => navigate('/login')}
          >
            Go to Login
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200"
            onClick={() => navigate('/')}
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
