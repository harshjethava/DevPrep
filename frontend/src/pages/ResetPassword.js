import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSignIn } from '@clerk/clerk-react';
import { Eye, EyeOff } from 'lucide-react';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPrepared, setIsPrepared] = useState(false);
  const [didAutoPrepare, setDidAutoPrepare] = useState(false);

  const isStrongPassword = (value) => {
    const v = String(value || '');
    if (v.length < 8) return false;
    if (!/[A-Z]/.test(v)) return false;
    if (!/[a-z]/.test(v)) return false;
    if (!/[0-9]/.test(v)) return false;
    if (!/[^A-Za-z0-9]/.test(v)) return false;
    return true;
  };

  const getEmailAddressIdForReset = () => {
    const factors = Array.isArray(signIn?.supportedFirstFactors) ? signIn.supportedFirstFactors : [];
    const factor = factors.find((f) => f && f.strategy === 'reset_password_email_code');
    return factor && factor.emailAddressId ? String(factor.emailAddressId) : '';
  };

  useEffect(() => {
    const stateEmail = location.state && location.state.email ? String(location.state.email) : '';
    const params = new URLSearchParams(location.search || '');
    const queryEmail = params.get('email') ? String(params.get('email')) : '';
    const resolved = (stateEmail || queryEmail).trim();

    if (!resolved) {
      toast.error('Please enter your email first');
      navigate('/forgot-password');
      return;
    }

    setEmail(resolved);
    const statePrepared = Boolean(location.state && location.state.prepared);
    setIsPrepared(statePrepared);
  }, [location.search, location.state, navigate]);

  const handleResend = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    if (!email.trim()) {
      toast.error('Email is required');
      return;
    }

    setResendLoading(true);
    try {
      await signIn.create({ identifier: email.trim() });

      const emailAddressId = getEmailAddressIdForReset();
      await signIn.prepareFirstFactor({
        strategy: 'reset_password_email_code',
        ...(emailAddressId ? { emailAddressId } : {})
      });
      setIsPrepared(true);
      toast.success('Reset code sent');
    } catch (err) {
      const msg = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || 'Something went wrong';
      toast.error(msg);
    } finally {
      setResendLoading(false);
    }
  }, [email, getEmailAddressIdForReset, isLoaded, signIn]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!email.trim()) return;
    if (isPrepared) return;
    if (didAutoPrepare) return;

    setDidAutoPrepare(true);
    handleResend();
  }, [didAutoPrepare, email, handleResend, isLoaded, isPrepared]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLoaded) {
      return;
    }

    if (!email) {
      toast.error('Email is required');
      return;
    }

    if (!code.trim()) {
      toast.error('Code is required');
      return;
    }

    if (!password) {
      toast.error('Password is required');
      return;
    }

    if (!isStrongPassword(password)) {
      toast.error('Password must be at least 8 characters and include uppercase, lowercase, number, and special character');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (!isPrepared) {
      toast.error('Please click Resend code first (refresh clears the verification session)');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: code.trim(),
        password
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        toast.success('Password reset successful');
        navigate('/dashboard');
      } else {
        toast.error('Could not complete password reset');
      }
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
        <div className="text-xl font-semibold">Reset Password</div>
        <div className="mt-2 text-sm text-slate-300">Set a new password for your account.</div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm text-slate-300">Reset code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              type="text"
              className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/20"
              autoComplete="one-time-code"
            />
            <button
              type="button"
              disabled={resendLoading || loading}
              className="mt-3 text-sm text-cyan-300 hover:text-cyan-200 disabled:opacity-60"
              onClick={handleResend}
            >
              {resendLoading ? 'Sending code...' : 'Resend code'}
            </button>
          </div>

          <div className="relative">
            <label className="text-sm text-slate-300">New password</label>
            <div className="relative mt-2">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? 'text' : 'password'}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-12 text-white outline-none focus:border-white/20"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-200 hover:text-white transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="relative">
            <label className="text-sm text-slate-300">Confirm password</label>
            <div className="relative mt-2">
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type={showConfirmPassword ? 'text' : 'password'}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 pr-12 text-white outline-none focus:border-white/20"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-200 hover:text-white transition-colors"
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold disabled:opacity-50 transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_rgba(139,92,246,0.35)]"
          >
            {loading ? 'Resetting...' : 'Reset password'}
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

export default ResetPassword;
