const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  console.log("Login form submitted");

  try {
    console.log("Calling login function");
    const userData = await login(formData);
    console.log("Login successful, userData:", userData);
    
    // Verify localStorage has been set
    console.log("localStorage token:", localStorage.getItem('token'));
    console.log("localStorage userId:", localStorage.getItem('userId'));
    console.log("localStorage isAuthenticated:", localStorage.getItem('isAuthenticated'));
    
    // Add a slight delay before navigation to ensure localStorage is updated
    setTimeout(() => {
      console.log("Navigating to /chat");
      // navigate("/chat");  // Replace with direct location change
      window.location.href = "/chat";  // Force a full page reload
    }, 300);
  } catch (err) {
    console.error("Login error:", err);
    setError(handleAuthError(err));
  } finally {
    setLoading(false);
  }
}; 