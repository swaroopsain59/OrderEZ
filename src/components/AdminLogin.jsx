function AdminLogin({ adminPasscode, errorMessage, isSubmitting, onChangePasscode, onUnlock }) {
  return (
    <section className="admin-login">
      <div className="login-card">
        <p className="eyebrow">Staff access</p>
        <h3>Admin dashboard is now backed by server auth.</h3>
        <p className="hero-text">
          This login now hits the Express backend and returns an admin session token. For the demo, the passcode is still 1234.
        </p>
        <form className="login-form" onSubmit={onUnlock}>
          <input
            className="search-input"
            type="password"
            value={adminPasscode}
            onChange={(event) => onChangePasscode(event.target.value)}
            placeholder="Enter admin passcode"
          />
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Unlocking..." : "Unlock admin"}
          </button>
        </form>
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </div>
    </section>
  );
}

export default AdminLogin;
