import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../context/LangContext'

function Login() {
  const { lang } = useLang()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  function reset() {
    setError('')
    setMessage('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }

  function switchMode(m) {
    reset()
    setMode(m)
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'http://localhost:5173' }
    })
  }

  async function handleSubmit() {
    setError('')
    setMessage('')

    if (!email) {
      setError(lang === 'en' ? 'Please enter your email.' : 'इमेल राख्नुहोस्।')
      return
    }
    if (mode !== 'forgot' && !password) {
      setError(lang === 'en' ? 'Please enter your password.' : 'पासवर्ड राख्नुहोस्।')
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError(lang === 'en' ? 'Passwords do not match.' : 'पासवर्ड मेल खाएन।')
      return
    }
    if (mode !== 'forgot' && password.length < 6) {
      setError(lang === 'en' ? 'Password must be at least 6 characters.' : 'पासवर्ड कम्तिमा ६ अक्षर हुनुपर्छ।')
      return
    }

    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(lang === 'en' ? 'Invalid email or password.' : 'इमेल वा पासवर्ड गलत छ।')
      else navigate('/')
    }

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage(lang === 'en'
        ? 'Registration successful! Check your email to confirm.'
        : 'दर्ता सफल! इमेल जाँच गर्नुहोस्।')
    }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'http://localhost:5173/reset-password'
      })
      if (error) setError(error.message)
      else setMessage(lang === 'en'
        ? 'Password reset link sent! Check your email.'
        : 'पासवर्ड रिसेट लिंक पठाइयो!')
    }

    setLoading(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="auth-page">
      <div className="auth-card">

        <div className="auth-logo">🛒 Tulana Kart</div>

        {mode !== 'forgot' && (
          <div className="auth-tabs">
            <button
              className={mode === 'login' ? 'active' : ''}
              onClick={() => switchMode('login')}
            >
              {lang === 'en' ? 'Login' : 'लगइन'}
            </button>
            <button
              className={mode === 'register' ? 'active' : ''}
              onClick={() => switchMode('register')}
            >
              {lang === 'en' ? 'Register' : 'दर्ता'}
            </button>
          </div>
        )}

        {mode === 'forgot' && (
          <h3 className="auth-forgot-title">
            {lang === 'en' ? 'Reset Password' : 'पासवर्ड रिसेट'}
          </h3>
        )}

        {message && <div className="auth-message">{message}</div>}
        {error && <div className="auth-error">{error}</div>}

        {mode !== 'forgot' && (
          <>
            <button className="auth-google" onClick={handleGoogleLogin}>
              <img src="https://www.google.com/favicon.ico" alt="Google" width="18" />
              {lang === 'en' ? 'Continue with Google' : 'Google मार्फत जारी राख्नुहोस्'}
            </button>
            <div className="auth-divider">
              <span>{lang === 'en' ? 'or' : 'वा'}</span>
            </div>
          </>
        )}

        <div className="auth-form">
          <div className="auth-field">
            <label>{lang === 'en' ? 'Email Address' : 'इमेल ठेगाना'}</label>
            <input
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>

          {mode !== 'forgot' && (
            <div className="auth-field">
              <label>{lang === 'en' ? 'Password' : 'पासवर्ड'}</label>
              <input
                type="password"
                placeholder={lang === 'en' ? 'Min. 6 characters' : 'कम्तिमा ६ अक्षर'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}

          {mode === 'register' && (
            <div className="auth-field">
              <label>{lang === 'en' ? 'Confirm Password' : 'पासवर्ड पुष्टि'}</label>
              <input
                type="password"
                placeholder={lang === 'en' ? 'Re-enter password' : 'पासवर्ड दोहोर्याउनुहोस्'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          )}

          {mode === 'login' && (
            <div className="auth-forgot-link">
              <span onClick={() => switchMode('forgot')}>
                {lang === 'en' ? 'Forgot password?' : 'पासवर्ड भुल्नुभयो?'}
              </span>
            </div>
          )}

          <button className="auth-submit" onClick={handleSubmit} disabled={loading}>
            {loading ? '...' : mode === 'login'
              ? (lang === 'en' ? 'Login' : 'लगइन')
              : mode === 'register'
              ? (lang === 'en' ? 'Create Account' : 'खाता बनाउनुहोस्')
              : (lang === 'en' ? 'Send Reset Link' : 'रिसेट लिंक पठाउनुहोस्')}
          </button>
        </div>

        <p className="auth-footer">
          {mode === 'forgot' ? (
            <span onClick={() => switchMode('login')}>
              {lang === 'en' ? 'Back to Login' : 'लगइनमा फर्कनुहोस्'}
            </span>
          ) : mode === 'login' ? (
            <>
              {lang === 'en' ? "Don't have an account? " : 'खाता छैन? '}
              <span onClick={() => switchMode('register')}>
                {lang === 'en' ? 'Register' : 'दर्ता गर्नुहोस्'}
              </span>
            </>
          ) : (
            <>
              {lang === 'en' ? 'Already have an account? ' : 'खाता छ? '}
              <span onClick={() => switchMode('login')}>
                {lang === 'en' ? 'Login' : 'लगइन'}
              </span>
            </>
          )}
        </p>

      </div>
    </div>
  )
}

export default Login