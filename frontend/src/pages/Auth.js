import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Sparkles, Code } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import FloatingLabelInput from '../components/FloatingLabelInput';
import { AnimatedDeveloper, EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import { useSignIn, useSignUp, useUser } from '@clerk/clerk-react';

const Auth = () => {
  const navigate = useNavigate();
  const { isSignedIn } = useUser();
  const { isLoaded: isSignInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [oauthRedirectLoading, setOauthRedirectLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationEmailAddressId, setVerificationEmailAddressId] = useState('');

  useEffect(() => {
    if (isSignedIn) {
      navigate('/dashboard');
    }
  }, [isSignedIn, navigate]);

  const splitName = (fullName) => {
    const parts = String(fullName || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const firstName = parts[0] || '';
    const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
    return { firstName, lastName };
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const isStrongPassword = (value) => {
    const v = String(value || '');
    if (v.length < 8) return false;
    if (!/[A-Z]/.test(v)) return false;
    if (!/[a-z]/.test(v)) return false;
    if (!/[0-9]/.test(v)) return false;
    if (!/[^A-Za-z0-9]/.test(v)) return false;
    return true;
  };

  const validateForm = () => {
    const newErrors = {};

    if (!isLogin && needsEmailVerification) {
      if (!verificationCode.trim()) {
        newErrors.verificationCode = 'Verification code is required';
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }
    
    if (!isLogin && !formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (!isStrongPassword(formData.password)) {
      newErrors.password =
        'Password must be at least 8 characters and include uppercase, lowercase, number, and special character';
    }
    
    if (!isLogin && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || oauthRedirectLoading) return;
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (isLogin) {
        if (!isSignInLoaded) return;

        const res = await signIn.create({
          identifier: formData.email,
          password: formData.password
        });

        if (res.status === 'complete') {
          await setActiveSignIn({ session: res.createdSessionId });
          toast.success('Login successful!');
        } else {
          const msg = 'Additional steps are required to sign in.';
          toast.error(msg);
          setErrors({ form: msg });
        }
      } else {
        if (!isSignUpLoaded) return;

        if (needsEmailVerification) {
          const attempt = await signUp.attemptEmailAddressVerification({
            code: verificationCode.trim(),
            ...(verificationEmailAddressId ? { emailAddressId: verificationEmailAddressId } : {})
          });

          if (attempt.status === 'complete') {
            await setActiveSignUp({ session: attempt.createdSessionId });
            toast.success('Email verified!');
          } else {
            const msg = 'Verification is not complete yet. Please try again.';
            toast.error(msg);
            setErrors({ form: msg });
          }

          return;
        }

        const res = await signUp.create({
          emailAddress: formData.email,
          password: formData.password,
          ...splitName(formData.name)
        });

        if (res.status === 'complete') {
          await setActiveSignUp({ session: res.createdSessionId });
          toast.success('Account created!');
        } else {
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          const possibleId =
            (signUp && signUp.emailAddress && signUp.emailAddress.id) ||
            signUp.emailAddressId ||
            (signUp && signUp.verifications && signUp.verifications.emailAddress && signUp.verifications.emailAddress.id) ||
            '';
          setVerificationEmailAddressId(possibleId ? String(possibleId) : '');
          setNeedsEmailVerification(true);
          toast.success('Check your email for the verification code.');
        }
      }
    } catch (err) {
      const msg = err?.errors?.[0]?.message || err?.message || 'Something went wrong';
      toast.error(msg);
      setErrors({ form: msg });
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
    setNeedsEmailVerification(false);
    setVerificationCode('');
    setVerificationEmailAddressId('');
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
  };

  const formVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { 
        type: 'spring', 
        stiffness: 100, 
        damping: 15,
        staggerChildren: 0.1
      }
    },
    exit: { 
      opacity: 0, 
      x: -50,
      transition: { duration: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white overflow-x-hidden relative">
      <EnhancedAnimatedBackground />
      
      <div className="relative z-10 min-h-screen grid lg:grid-cols-2 gap-8 p-4 lg:p-8">
        {/* Left Side - Animated Developer Illustration */}
        <motion.div 
          className="hidden lg:flex flex-col justify-center items-center p-12 relative"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          <AnimatedDeveloper />

          <motion.div
            className="mt-12 text-center relative z-20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <motion.h1 
              className="text-6xl font-bold mb-4 bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent" 
              style={{ fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: 'linear'
              }}
            >
              DevPrep
            </motion.h1>
            <motion.p 
              className="text-xl text-slate-300" 
              style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              animate={{
                opacity: [0.7, 1, 0.7]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            >
              Your portal to interview mastery
            </motion.p>
            
            {/* Animated stats */}
            <motion.div 
              className="flex gap-8 mt-6 justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              {[
                { label: 'Questions', value: '1000+', icon: '📝' },
                { label: 'Interviews', value: '500+', icon: '🎯' },
                { label: 'Success', value: '95%', icon: '✨' }
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  className="text-center"
                  whileHover={{ scale: 1.1, y: -5 }}
                  animate={{
                    y: [0, -5, 0]
                  }}
                  transition={{
                    y: {
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.3
                    }
                  }}
                >
                  <div className="text-2xl mb-1">{stat.icon}</div>
                  <div className="text-2xl font-bold text-cyan-400">{stat.value}</div>
                  <div className="text-xs text-slate-400">{stat.label}</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Right Side - Form */}
        <div className="flex items-center justify-center p-4 lg:p-12 relative">
          {/* Animated decorative elements around form */}
          <motion.div
            className="absolute top-10 right-10 text-4xl"
            animate={{
              rotate: [0, 360],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: 20,
              repeat: Infinity,
              ease: 'linear'
            }}
          >
            ⚡
          </motion.div>
          
          <motion.div
            className="absolute bottom-10 left-10 text-4xl"
            animate={{
              rotate: [360, 0],
              y: [0, -10, 0]
            }}
            transition={{
              duration: 15,
              repeat: Infinity,
              ease: 'easeInOut'
            }}
          >
            🚀
          </motion.div>
          
          <motion.div
            className="w-full max-w-md relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* Animated border glow */}
            <motion.div
              className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 to-red-500/20 opacity-20 blur-xl"
              animate={{
                opacity: [0.2, 0.4, 0.2],
                scale: [1, 1.05, 1]
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
            
            {/* Glass Card */}
            <div className="relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] lg:min-h-[640px]">
              {/* Logo for mobile with animation */}
              <div className="lg:hidden text-center mb-8">
                <motion.h1 
                  className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent" 
                  style={{ fontFamily: 'Outfit, sans-serif' }}
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity
                  }}
                >
                  DevPrep
                </motion.h1>
              </div>

              {/* Tab Switcher with enhanced animations */}
              <div className="relative flex gap-2 mb-8 p-1 bg-white/5 rounded-lg">
                <motion.div
                  className="absolute top-1 bottom-1 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-md shadow-lg"
                  animate={{
                    left: isLogin ? '4px' : 'calc(50% + 4px)',
                    width: 'calc(50% - 8px)'
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 30
                  }}
                />
                <button
                  onClick={() => !isLogin && toggleAuthMode()}
                  className={`relative z-10 flex-1 py-2.5 rounded-md font-medium transition-all duration-300 ${
                    isLogin ? 'text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  data-testid="login-tab"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  Login
                </button>
                <button
                  onClick={() => isLogin && toggleAuthMode()}
                  className={`relative z-10 flex-1 py-2.5 rounded-md font-medium transition-all duration-300 ${
                    !isLogin ? 'text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  data-testid="register-tab"
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  Register
                </button>
              </div>

              {/* Forms */}
              <AnimatePresence mode="wait">
                <motion.form
                  key={isLogin ? 'login' : 'register'}
                  variants={formVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  onSubmit={handleSubmit}
                  style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                >
                  <div id="clerk-captcha" style={{ display: 'none' }} />
                  {/* Registration Fields */}
                  {!isLogin && (
                    <motion.div variants={itemVariants}>
                      <FloatingLabelInput
                        id="name"
                        type="text"
                        label="Full Name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        error={errors.name}
                      />
                    </motion.div>
                  )}

                  {/* Email Field */}
                  <motion.div variants={itemVariants}>
                    <FloatingLabelInput
                      id="email"
                      type="email"
                      label="Email Address"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      error={errors.email}
                    />
                  </motion.div>

                  {/* Password Field */}
                  <motion.div variants={itemVariants} className="relative">
                    <FloatingLabelInput
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      label="Password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      error={errors.password}
                      className="pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-200 hover:text-white transition-colors"
                      data-testid="toggle-password"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </motion.div>

                  {/* Form-level error */}
                  {errors.form && (
                    <motion.div variants={itemVariants} className="text-red-400 text-sm text-center mt-2">
                      {errors.form}
                    </motion.div>
                  )}

                  {/* Confirm Password for Registration */}
                  {!isLogin && (
                    <motion.div variants={itemVariants}>
                      <FloatingLabelInput
                        id="confirmPassword"
                        type="password"
                        label="Confirm Password"
                        value={formData.confirmPassword}
                        onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                        error={errors.confirmPassword}
                      />
                    </motion.div>
                  )}

                  {/* Verification Code */}
                  {!isLogin && needsEmailVerification && (
                    <motion.div variants={itemVariants}>
                      <FloatingLabelInput
                        id="verificationCode"
                        type="text"
                        label="Verification Code"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        error={errors.verificationCode}
                      />
                    </motion.div>
                  )}
                  {/* Remember Me / Forgot Password */}
                  {isLogin && (
                    <motion.div variants={itemVariants} className="flex items-center justify-between mb-6 text-sm">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-white/20 bg-white/5 text-violet-600 focus:ring-violet-500 focus:ring-offset-0 cursor-pointer"
                          data-testid="remember-me"
                        />
                        <span className="text-slate-400 group-hover:text-white transition-colors">Remember me</span>
                      </label>
                      <button 
                        type="button" 
                        className="text-cyan-400 hover:text-cyan-300 transition-colors"
                        data-testid="forgot-password"
                        onClick={() => navigate('/forgot-password')}
                      >
                        Forgot password?
                      </button>
                    </motion.div>
                  )}

                  {/* Submit Button with enhanced animation */}
                  <motion.button
                    variants={itemVariants}
                    type="submit"
                    disabled={loading}
                    className={`relative w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold rounded-lg overflow-hidden group ${loading ? 'opacity-80 cursor-not-allowed' : ''}`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    data-testid="submit-button"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-violet-400 opacity-0 group-hover:opacity-100"
                      transition={{ duration: 0.3 }}
                    />
                    <motion.div
                      className="absolute inset-0"
                      animate={{
                        boxShadow: [
                          '0 0 0px rgba(124,58,237,0)',
                          '0 0 20px rgba(124,58,237,0.5)',
                          '0 0 0px rgba(124,58,237,0)'
                        ]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity
                      }}
                    />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {loading
                        ? (isLogin ? 'Signing in…' : needsEmailVerification ? 'Verifying…' : 'Creating account…')
                        : (isLogin ? 'Sign In' : 'Create Account')}
                      {!loading && (
                        <motion.span
                          animate={{ x: [0, 5, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          →
                        </motion.span>
                      )}
                    </span>
                  </motion.button>

                  {/* Divider */}
                  <motion.div variants={itemVariants} className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-[#030712] text-slate-400">or continue with</span>
                    </div>
                  </motion.div>

                  {/* Social Login with enhanced hover effects */}
                  <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
                    <motion.button
                      type="button"
                      disabled={loading || oauthRedirectLoading}
                      className={`relative flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-lg overflow-hidden group ${
                        loading || oauthRedirectLoading ? 'opacity-80 cursor-not-allowed' : ''
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      data-testid="google-login"
                      onClick={() => {
                        if (!isSignInLoaded) return;
                        if (loading || oauthRedirectLoading) return;
                        setOauthRedirectLoading(true);
                        signIn.authenticateWithRedirect({
                          strategy: 'oauth_google',
                          redirectUrl: '/sso',
                          redirectUrlComplete: '/dashboard'
                        });
                      }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-red-500/20 opacity-0 group-hover:opacity-100"
                        transition={{ duration: 0.3 }}
                      />
                      <svg className="relative z-10 w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="relative z-10 text-white">Google</span>
                    </motion.button>
                    <motion.button
                      type="button"
                      disabled={loading || oauthRedirectLoading}
                      className={`relative flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/10 rounded-lg overflow-hidden group ${
                        loading || oauthRedirectLoading ? 'opacity-80 cursor-not-allowed' : ''
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      data-testid="github-login"
                      onClick={() => {
                        if (!isSignInLoaded) return;
                        if (loading || oauthRedirectLoading) return;
                        setOauthRedirectLoading(true);
                        signIn.authenticateWithRedirect({
                          strategy: 'oauth_github',
                          redirectUrl: '/sso',
                          redirectUrlComplete: '/dashboard'
                        });
                      }}
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-slate-700/20 to-slate-500/20 opacity-0 group-hover:opacity-100"
                        transition={{ duration: 0.3 }}
                      />
                      <svg className="relative z-10 w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                      <span className="relative z-10 text-white">GitHub</span>
                    </motion.button>
                  </motion.div>

                  {/* Toggle Auth Mode */}
                  <motion.p 
                    variants={itemVariants} 
                    className="text-center mt-6 text-sm text-slate-400"
                  >
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button
                      type="button"
                      onClick={toggleAuthMode}
                      className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
                      data-testid="toggle-auth-mode"
                    >
                      {isLogin ? 'Sign up' : 'Sign in'}
                    </button>
                  </motion.p>
                </motion.form>
              </AnimatePresence>
            </div>

            {/* Floating decoration */}
            <motion.div
              className="mt-8 text-center text-sm text-slate-500 flex items-center justify-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="inline-block w-4 h-4 text-violet-400" />
              </motion.div>
              <span>Powered by AI-driven interview preparation</span>
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Code className="inline-block w-4 h-4 text-cyan-400" />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
