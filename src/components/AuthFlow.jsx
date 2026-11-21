import React, { useEffect, useRef, useState } from "react";

import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  updateProfile,
  onAuthStateChanged,
  reload,
  signOut
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "firebase/firestore";

import { auth, db, googleProvider } from "../firebase";
import {
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Mail,
  Phone,
  ShieldCheck,
  User,
  Sparkles,
  Plane,
  BookOpen,
  Users
} from "lucide-react";

import "./AuthStyles.css";

export default function AuthFlow({ onAuthenticated }) {
  const [screen, setScreen] = useState("welcome");
  const [mode, setMode] = useState("email");

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [username, setUsername] = useState("");

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const recaptchaRef = useRef(null);

  const clearMessages = () => {
    setError("");
    setMessage("");
  };

  const getProfile = async (user) => {
    const profileRef = doc(db, "users", user.uid);
    const profileSnap = await getDoc(profileRef);

    if (!profileSnap.exists()) {
      return null;
    }

    return profileSnap.data();
  };

  const finishAuthentication = async (user) => {
    const profile = await getProfile(user);

    onAuthenticated({
      ...user,
      profile
    });
  };

  const saveProfile = async (user) => {
    const profileRef = doc(db, "users", user.uid);

    await setDoc(profileRef, {
      uid: user.uid,
      fullName: name.trim(),
      username: username.trim().toLowerCase(),
      dateOfBirth: dob,
      email: user.email || "",
      phone: user.phoneNumber || "",
      createdAt: serverTimestamp()
    }, { merge: true });
  };

  const validateSignup = () => {
    if (!name.trim()) {
      throw new Error("Please enter your full name.");
    }

    if (!dob) {
      throw new Error("Please select your date of birth.");
    }

    const birthDate = new Date(`${dob}T00:00:00`);
    if (
      Number.isNaN(birthDate.getTime()) ||
      birthDate >= new Date()
    ) {
      throw new Error("Please enter a valid date of birth.");
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      throw new Error(
        "Username must be 3-20 characters (letters, numbers or _)."
      );
    }
  };

  const handleGoogle = async () => {
    clearMessages();
    setLoading(true);

    try {
      const result = await signInWithPopup(
        auth,
        googleProvider
      );

      const user = result.user;

      const profile = await getProfile(user);

      if (!profile) {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          fullName: user.displayName || "",
          email: user.email || "",
          username: "",
          dateOfBirth: "",
          createdAt: serverTimestamp()
        });
      }

      await finishAuthentication(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e) => {
    e.preventDefault();
    clearMessages();

    try {
      validateSignup();

      if (!email.trim()) {
        throw new Error("Enter your email address.");
      }

      if (password.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      setLoading(true);

      const result = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await updateProfile(result.user, {
        displayName: name.trim()
      });

      await saveProfile(result.user);

      await sendEmailVerification(result.user);

      setMessage(
        "Verification email sent. Verify your email, then return and log in."
      );

      await signOut(auth);

      setScreen("login");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setupRecaptcha = () => {
    if (recaptchaRef.current) {
      recaptchaRef.current.clear();
      recaptchaRef.current = null;
    }

    recaptchaRef.current = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      {
        size: "normal"
      }
    );

    return recaptchaRef.current;
  };

  const sendPhoneOTP = async (e) => {
    e.preventDefault();
    clearMessages();

    try {
      if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) {
        throw new Error(
          "Enter phone number with country code, e.g. +91XXXXXXXXXX."
        );
      }

      setLoading(true);

      const verifier = setupRecaptcha();

      const result = await signInWithPhoneNumber(
        auth,
        phone.trim(),
        verifier
      );

      setConfirmation(result);
      setMessage("OTP sent successfully to your phone.");
      setScreen("otp");
    } catch (err) {
      setError(err.message);

      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneOTP = async (e) => {
    e.preventDefault();
    clearMessages();

    try {
      if (!confirmation || !/^\d{6}$/.test(otp)) {
        throw new Error("Enter the valid 6-digit OTP.");
      }

      setLoading(true);

      const result = await confirmation.confirm(otp);

      await saveProfile(result.user);

      await finishAuthentication(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    clearMessages();

    try {
      setLoading(true);

      const result = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await reload(result.user);

      if (!result.user.emailVerified) {
        await signOut(auth);
        throw new Error("Please verify your email before logging in.");
      }

      await finishAuthentication(result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    clearMessages();

    if (!email.trim()) {
      setError("Enter your registered email first.");
      return;
    }

    try {
      setLoading(true);

      await sendPasswordResetEmail(auth, email.trim());

      setMessage("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
    };
  }, []);

  const goBack = () => {
    clearMessages();

    if (recaptchaRef.current) {
      recaptchaRef.current.clear();
      recaptchaRef.current = null;
    }

    setScreen("auth");
  };

  return (
    <div className="auth-page">

      <div className="auth-glow auth-glow-one"></div>
      <div className="auth-glow auth-glow-two"></div>

      <div className="auth-brand">
        <div className="auth-brand-logo">CP</div>
        <div>
          <h2>Caspian Pal</h2>
          <span>CONNECT • EXPLORE • GROW</span>
        </div>
      </div>

      <div className="auth-card">

        {screen !== "welcome" && (
          <button className="auth-back" onClick={goBack}>
            <ArrowLeft size={21} />
          </button>
        )}

        {/* WELCOME */}

        {screen === "welcome" && (
          <div className="auth-welcome">

            <div className="auth-profile">
              <User size={55} />
              <Sparkles className="profile-sparkle" />
            </div>

            <span className="auth-eyebrow">
              YOUR JOURNEY STARTS HERE
            </span>

            <h1>
              Welcome to
              <span> Caspian Pal</span>
            </h1>

            <h3>Namaskar Dosto 🙏</h3>

            <p>
              Discover people, find travel companions,
              play sports and learn together.
            </p>

            <div className="auth-interests">
              <span><Plane /> Travel</span>
              <span><BookOpen /> Study</span>
              <span><Users /> Friends</span>
            </div>

            <button
              className="auth-primary"
              onClick={() => setScreen("auth")}
            >
              Let's Get Started <ArrowRight size={19} />
            </button>
          </div>
        )}

        {/* AUTH OPTIONS */}

        {screen === "auth" && (
          <div className="auth-options">
            <div className="cp-logo">CP</div>

            <h1>Welcome aboard!</h1>
            <p>Choose how you want to continue.</p>

            <button
              className="google-button"
              onClick={handleGoogle}
              disabled={loading}
            >
              <span className="google-letter">G</span>
              Continue with Google
            </button>

            <button
              className="auth-primary"
              onClick={() => {
                setMode("email");
                setScreen("signup");
              }}
            >
              Create Account
            </button>

            <p className="auth-bottom-text">
              Already have an account?
              <button onClick={() => setScreen("login")}>
                Log in
              </button>
            </p>
          </div>
        )}

        {/* SIGNUP */}

        {screen === "signup" && (
          <form onSubmit={mode === "email" ? handleEmailSignup : sendPhoneOTP}>

            <span className="auth-eyebrow">CREATE YOUR ACCOUNT</span>

            <h1>Join Caspian Pal</h1>

            <div className="auth-mode-switch">
              <button
                type="button"
                className={mode === "email" ? "active" : ""}
                onClick={() => setMode("email")}
              >
                Email
              </button>

              <button
                type="button"
                className={mode === "phone" ? "active" : ""}
                onClick={() => setMode("phone")}
              >
                Phone
              </button>
            </div>

            <label>Full Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your full name"
              required
            />

            <label>Date of Birth</label>
            <input
              type="date"
              value={dob}
              max={new Date().toISOString().split("T")[0]}
              onChange={e => setDob(e.target.value)}
              required
            />

            <label>Choose Username</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Choose a unique username"
              minLength={3}
              maxLength={20}
              required
            />

            {mode === "email" ? (
              <>
                <label>Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  required
                />

                <label>Password</label>
                <div className="password-field">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Create password"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>

                <label>Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  required
                />
              </>
            ) : (
              <>
                <label>Mobile Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91XXXXXXXXXX"
                  required
                />
                <p className="auth-hint">
                  Include your country code. Firebase will send a real SMS OTP.
                </p>
                <div id="recaptcha-container"></div>
              </>
            )}

            <button
              className="auth-primary"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "email"
                  ? "Create Account"
                  : "Send OTP"}
              <ArrowRight size={18} />
            </button>

            <p className="auth-bottom-text">
              Already registered?
              <button type="button" onClick={() => setScreen("login")}>
                Log in
              </button>
            </p>
          </form>
        )}

        {/* LOGIN */}

        {screen === "login" && (
          <form onSubmit={handleLogin}>
            <span className="auth-eyebrow">WELCOME BACK</span>

            <h1>Log in</h1>
            <p className="auth-subtitle">
              Continue your journey with Caspian Pal.
            </p>

            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter registered email"
              required
            />

            <label>Password</label>

            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>

            <button
              type="button"
              className="forgot-password"
              onClick={handleForgotPassword}
            >
              Forgot Password?
            </button>

            <button
              type="submit"
              className="auth-primary"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Log In"}
              <ArrowRight size={18} />
            </button>

            <div className="auth-divider">
              <span>OR</span>
            </div>

            <button
              type="button"
              className="google-button"
              onClick={handleGoogle}
              disabled={loading}
            >
              <span className="google-letter">G</span>
              Continue with Google
            </button>

            <p className="auth-bottom-text">
              New to Caspian Pal?
              <button
                type="button"
                onClick={() => setScreen("signup")}
              >
                Sign Up
              </button>
            </p>
          </form>
        )}

        {/* PHONE OTP */}

        {screen === "otp" && (
          <form onSubmit={verifyPhoneOTP}>
            <div className="otp-icon">
              <ShieldCheck size={35} />
            </div>

            <h1>Verify your number</h1>

            <p className="auth-subtitle">
              Enter the 6-digit code sent to {phone}.
            </p>

            <label>Verification Code</label>

            <input
              className="otp-input"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              required
            />

            <button
              type="submit"
              className="auth-primary"
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify & Continue"}
            </button>

            <button
              type="button"
              className="auth-back-text"
              onClick={() => {
                setConfirmation(null);
                setOtp("");
                setScreen("signup");
              }}
            >
              Change phone number
            </button>
          </form>
        )}

        {message && <div className="auth-success">{message}</div>}
        {error && <div className="auth-error">{error}</div>}

      </div>

      <footer className="auth-page-footer">
        <ShieldCheck size={15} />
        Secure authentication by Firebase
      </footer>

    </div>
  );
}