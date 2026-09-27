import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSignIn } from '@clerk/clerk-react';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { isLoaded, signIn } = useSignIn();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const getEmailAddressIdForReset = () => {
    const factors = Array.isArray(signIn?.supportedFirstFactors) ? signIn.supportedFirstFactors : [];
    const factor = factors.find((f) => f && f.strategy === 'reset_password_email_code');
    return factor && factor.emailAddressId ? String(factor.emailAddressId) : '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLoaded) {
      return;
    }

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    setLoading(true);
    try {
      await signIn.create({ identifier: email.trim() });

      const emailAddressId = getEmailAddressIdForReset();

      await signIn.prepareFirstFactor({
        strategy: 'reset_password_email_code',
        ...(emailAddressId ? { emailAddressId } : {})
      });

      toast.success('Check your email for the reset code');
      const cleanEmail = email.trim();
      navigate(`/reset-password?email=${encodeURIComponent(cleanEmail)}`, {
        state: { email: cleanEmail, prepared: true }
      });
    } catch (err) {
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || 'Something went wrong';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="text-xl font-semibold">Forgot Password</div>
        <div className="mt-2 text-sm text-slate-300">Enter your email and we’ll send you a reset code.</div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm text-slate-300">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/20"
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold disabled:opacity-50 transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_rgba(139,92,246,0.35)]"
          >
            {loading ? 'Sending...' : 'Send reset code'}
          </button>

          <button
            type="button"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200"
            onClick={() => navigate('/login')}
          >
            Back to login
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
