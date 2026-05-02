(async () => {
  const status = document.getElementById("status");
  const btn = document.getElementById("loginBtn");

  if (!window.ENV?.SUPABASE_URL || !window.ENV?.SUPABASE_ANON_KEY) {
    status.textContent = "Missing Supabase config. Add SUPABASE_URL and SUPABASE_ANON_KEY.";
    return;
  }

  const supabase = window.supabase.createClient(
    window.ENV.SUPABASE_URL,
    window.ENV.SUPABASE_ANON_KEY,
    { auth: { persistSession: true, detectSessionInUrl: true } }
  );

  window.sb = supabase;

  btn.onclick = async () => {
    try {
      btn.disabled = true;
      status.textContent = "Redirecting to Google...";
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/login.html"
        }
      });
      setTimeout(() => { if (!btn.disabled) return; btn.disabled = false; }, 5000);
    } catch (err) {
      console.error("OAuth start failed", err);
      status.textContent = "Auth start failed. Try again.";
      btn.disabled = false;
    }
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const email = session.user.email;
    status.textContent = "Checking account type...";
    console.log("Logged in as:", email);

    try {
      const { data: vip } = await supabase
        .from("vip_user")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (vip) {
        status.textContent = "Accessing as VIP user ";
        console.log(" Access granted as VIP user");
        await new Promise(r => setTimeout(r, 1000));
        localStorage.setItem("user_email", email);
        localStorage.setItem("session_expires_at", Date.now() + (10 * 60 * 1000));
        startConsoleTimer(10 * 60);
        setTimeout(() => window.location.replace("/front.html"), 500);
        return;
      }
    } catch (e) {
      console.error("VIP lookup failed", e);
    }

    try {
      const { data, error } = await supabase.rpc("claim_slot", { p_email: email });

      if (error) {
        console.error("claim_slot error", error);
        status.textContent = "Server error. Try again later.";
        await supabase.auth.signOut();
        return;
      }

      if (data === "FULL") {
        status.textContent = "All slots are full. Try later.";
        console.warn("Trial slots full");
        await supabase.auth.signOut();
        return;
      }

      if (data === "OK") {
        status.textContent = "Accessing as normal user ";
        console.log(" Access granted as normal user");
        await new Promise(r => setTimeout(r, 1000));
        console.log("NORMAL USER - 10 minute trial");
        localStorage.setItem("user_email", email);
        localStorage.setItem("session_expires_at", Date.now() + (10 * 60 * 1000));
        startConsoleTimer(10 * 60);
        setTimeout(() => window.location.replace("/front.html"), 500);
        return;
      }

      console.warn("Unexpected claim_slot response:", data);
      status.textContent = "Access denied.";
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Error claiming slot:", e);
      status.textContent = "Server error. Try again later.";
      await supabase.auth.signOut();
    }
  } catch (e) {
    console.error("Session check failed:", e);
  }

  function startConsoleTimer(seconds) {
    const expiresAt = Date.now() + seconds * 1000;
    console.log("Session expires at:", new Date(expiresAt).toLocaleTimeString());
    const t = setInterval(() => {
      const left = Math.ceil((expiresAt - Date.now()) / 1000);
      if (left <= 0) {
        console.log("SESSION EXPIRED");
        clearInterval(t);
      } else {
        console.log("Time left:", left, "seconds");
      }
    }, 1000);
  }
})();

// Mobile Warning Functions
function isMobile() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent)
    || window.innerWidth < 768;
}
function closeMobileWarn() {
  const el = document.getElementById("mobileWarn");
  if (el) el.style.display = "none";
}
if (isMobile()) {
  const el = document.getElementById("mobileWarn");
  if (el) el.style.display = "flex";
}
window.closeMobileWarn = closeMobileWarn;
