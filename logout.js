<script>
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("logoutBtn");
  if (!btn) {
    console.error("logoutBtn not found");
    return;
  }

  btn.addEventListener("click", async () => {
    try {
      // Check if Supabase client is available
      if (!window.sb) {
        alert("System not ready. Please refresh the page.");
        return;
      }

      const supabase = window.sb;
      const email = localStorage.getItem("user_email");
      
      console.log("Logout clicked by:", email);

      // STEP 1: RELEASE SLOT FROM NORMAL_USER (if email exists)
      if (email) {
        try {
          // First try the RPC function (recommended)
          const { error: rpcError } = await supabase.rpc("release_slot", {
            p_email: email
          });
          
          if (rpcError) {
            console.warn("RPC release_slot failed, trying direct delete:", rpcError);
            
            // Fallback: Direct delete
            const { error: deleteError } = await supabase
              .from("normal_user")
              .delete()
              .eq("email", email);
              
            if (deleteError) {
              console.error("Direct delete also failed:", deleteError);
            } else {
              console.log("Direct delete successful for:", email);
            }
          } else {
            console.log("RPC release_slot successful for:", email);
          }
        } catch (slotError) {
          console.error("Error removing from normal_user:", slotError);
        }
      }

      // STEP 2: SIGN OUT FROM SUPABASE AUTH
      await supabase.auth.signOut();

      // STEP 3: CLEAR ALL LOCAL STORAGE
      localStorage.clear();
      sessionStorage.clear();

      // STEP 4: REDIRECT TO LOGIN
      window.location.replace("/login.html");

    } catch (err) {
      console.error("Logout error:", err);
      alert("Logout failed. Please try again.");
    }
  });
});
</script>